'use client';

import { Coins, coinsToGoldSilverCopper } from '@/components/Format/Coins';
import { FormatDate } from '@/components/Format/FormatDate';
import { FormatNumber } from '@/components/Format/FormatNumber';
import type { TradingPostHistory } from '@gw2treasures/database';
import { AxisBottom, AxisLeft, AxisRight, type TickRendererProps } from '@visx/axis';
import { curveLinear, curveMonotoneX } from '@visx/curve';
import { localPoint } from '@visx/event';
import { GridColumns, GridRows } from '@visx/grid';
import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleLinear, scaleTime } from '@visx/scale';
import { Bar, Circle, Line, LinePath } from '@visx/shape';
import { Threshold } from '@visx/threshold';
import { Tooltip, TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { bisector, extent } from 'd3-array';
import { useMemo, type FC, type MouseEvent, type TouchEvent, useState, useId, type ReactNode, useRef, type KeyboardEventHandler, useCallback } from 'react';
import tipStyles from '@gw2treasures/ui/components/Tip/Tip.module.css';
import styles from './trading-post-history.module.css';
import { Checkbox } from '@gw2treasures/ui/components/Form/Checkbox';
import { DropDown } from '@gw2treasures/ui/components/DropDown/DropDown';
import { Button, LinkButton } from '@gw2treasures/ui/components/Form/Button';
import { MenuList } from '@gw2treasures/ui/components/Layout/MenuList';
import { FlexRow } from '@gw2treasures/ui/components/Layout/FlexRow';
import type BaseBrush from '@visx/brush/lib/BaseBrush';
import { Brush } from '@visx/brush';
import type { Bounds, PartialBrushStartEnd } from '@visx/brush/lib/types';
import { Icon } from '@gw2treasures/ui';

export interface TradingPostHistoryClientProps {
  history: TradingPostHistory[]
}

export const TradingPostHistoryClient: FC<TradingPostHistoryClientProps> = (props) => {
  return (<ParentSize ignoreDimensions={['height', 'top', 'left']} style={{ height: 'auto' }}>{({ width }) => width > 80 && <TradingPostHistoryClientInternal width={width} {...props}/>}</ParentSize>);
};

export interface TradingPostHistoryClientInternalProps extends TradingPostHistoryClientProps {
  width: number;
}

const bisectDate = bisector<TradingPostHistory, Date>((d) => d.time).left;

// color config
const colors = {
  sellPrice: '#1976D2',
  buyPrice: '#D32F2F',
  sellQuantity: '#4FC3F7',
  buyQuantity: '#FF7043',
};

const labels = {
  sellPrice: 'Sell Price',
  buyPrice: 'Buy Price',
  sellQuantity: 'Sell Listings',
  buyQuantity: 'Buy Orders',
};

// size of chart
const height = 420;
const brushBorder = 2;
const brushHeight = 48;
const marginDefault = { top: 20, bottom: 40, left: 88, right: 88 };
const marginMobile = { top: 20, bottom: 40, left: 0, right: 0 };

const threeMonthsAgo = new Date();
threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

const datawars2DataBefore = new Date('2023-12-27');

function downSample<T>(data: T[], points: number): T[] {
  // TODO: use some more advanced downsampling
  const bucketSize = Math.ceil(data.length / points);
  return data.filter((_, i) => i % bucketSize === 0);
}

export const TradingPostHistoryClientInternal: FC<TradingPostHistoryClientInternalProps> = ({ history: completeHistory, width }) => {
  // reference to the brush element
  const brushRef = useRef<BaseBrush>(null);

  // data of the selected range
  const [data, setData] = useState(completeHistory.filter((d) => d.time > threeMonthsAgo));

  // options
  const [visibility, setVisibility] = useState({ sellPrice: true, buyPrice: true, sellQuantity: true, buyQuantity: true });
  const [thresholdVisible, setThresholdVisible] = useState(true);
  const [smoothCurve, setSmoothCurve] = useState(true);
  const curve = smoothCurve ? curveMonotoneX : curveLinear;

  // calculate max values
  const max = useMemo(() => data.reduce<{ sellPrice: number, buyPrice: number, sellQuantity: number, buyQuantity: number }>(
    (max, current) => ({
      sellPrice: Math.max(max.sellPrice, current.sellPrice ?? 0),
      buyPrice: Math.max(max.buyPrice, current.buyPrice ?? 0),
      sellQuantity: Math.max(max.sellQuantity, current.sellQuantity ?? 0),
      buyQuantity: Math.max(max.buyQuantity, current.buyQuantity ?? 0),
    }), { sellPrice: 0, buyPrice: 0, sellQuantity: 0, buyQuantity: 0 }),
    [data]
  );
  const maxComplete = useMemo(() => completeHistory.reduce<{ sellPrice: number, buyPrice: number, sellQuantity: number, buyQuantity: number }>(
    (max, current) => ({
      sellPrice: Math.max(max.sellPrice, current.sellPrice ?? 0),
      buyPrice: Math.max(max.buyPrice, current.buyPrice ?? 0),
      sellQuantity: Math.max(max.sellQuantity, current.sellQuantity ?? 0),
      buyQuantity: Math.max(max.buyQuantity, current.buyQuantity ?? 0),
    }), { sellPrice: 0, buyPrice: 0, sellQuantity: 0, buyQuantity: 0 }),
    [completeHistory]
  );

  // sizing
  const isMobile = width < 720;
  const margin = isMobile ? marginMobile : marginDefault;

  const yMax = useMemo(() => height - margin.top - margin.bottom, [margin]);

  // y-scales for main chart
  const priceScale = useMemo(() => scaleLinear({
    range: [yMax, 0],
    round: true,
    domain: [0, Math.max(max.sellPrice, max.buyPrice)],
    nice: true,
  }), [max.buyPrice, max.sellPrice, yMax]);

  const quantityScale = useMemo(() => scaleLinear({
    range: [yMax, 0],
    round: true,
    domain: [0, Math.max(max.sellQuantity, max.buyQuantity)],
    nice: true,
  }), [max.buyQuantity, max.sellQuantity, yMax]);

  // y-scales for brush
  const priceBrushScale = useMemo(() => scaleLinear({
    range: [brushHeight, 0],
    round: true,
    domain: [0, Math.max(maxComplete.sellPrice, maxComplete.buyPrice)],
    nice: true,
  }), [maxComplete.buyPrice, maxComplete.sellPrice]);

  const quantityBrushScale = useMemo(() => scaleLinear({
    range: [brushHeight, 0],
    round: true,
    domain: [0, Math.max(maxComplete.sellQuantity, maxComplete.buyQuantity)],
    nice: true,
  }), [maxComplete.buyQuantity, maxComplete.sellQuantity]);

  // calculate left/right margin depending on y-scales
  const dynamicMargin = useMemo(() => isMobile ? { left: 0, right: 0 } : {
    left: visibility.sellPrice || visibility.buyPrice ? priceScale.ticks(6).map((v) => estimateGoldTickLength(v) + 20).reduce((max, length) => Math.max(max, length), 0) : 0,
    right: visibility.sellQuantity || visibility.buyQuantity ? quantityScale.ticks(6).map((value) => quantityScale.tickFormat(6)(value).length * 8 + 8).reduce((max, length) => Math.max(max, length), 0) : 0,
  }, [isMobile, priceScale, quantityScale, visibility.buyPrice, visibility.buyQuantity, visibility.sellPrice, visibility.sellQuantity]);

  const xMax = width - dynamicMargin.left - dynamicMargin.right;

  // x-scale for main chart
  const xScale = useMemo(() => scaleTime({
    range: [0, xMax],
    round: true,
    domain: extent(data, ({ time }) => time) as [Date, Date],
  }), [data, xMax]);

  // x-scale for brush
  const xBrushScale = useMemo(() => scaleTime({
    range: [0, width - brushBorder * 2],
    round: true,
    domain: extent(completeHistory, ({ time }) => time) as [Date, Date],
  }), [completeHistory, width]);

  // helper functions
  const x = useCallback((d: TradingPostHistory) => xScale(d.time), [xScale]);

  // tooltip
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<TradingPostHistory>();

  // tooltip event handler
  const handleTooltip = (event: TouchEvent<SVGRectElement> | MouseEvent<SVGRectElement>) => {
    const { x, y } = localPoint(event) || { x: 0, y: 0 };
    const x0 = xScale.invert(x - dynamicMargin.left);
    const index = bisectDate(data, x0, 1);
    const d0 = data[index - 1];
    const d1 = data[index];
    let d = d0;
    if (d1) {
      d = x0.valueOf() - d0.time.valueOf() > d1.time.valueOf() - x0.valueOf() ? d1 : d0;
    }

    showTooltip({
      tooltipData: d,
      tooltipLeft: x,
      tooltipTop: y,
    });
  };

  // brush initial position
  const initialBrushPosition: PartialBrushStartEnd = useMemo(() => ({
    start: { x: xBrushScale(new Date()) },
    end: { x: xBrushScale(threeMonthsAgo) }
  }), [xBrushScale]);

  // brush handler
  const ignoreNextChange = useRef(false);
  const handleBrushChange = useCallback((domain: Bounds | null) => {
    if(!domain || ignoreNextChange.current) {
      ignoreNextChange.current = false;
      return;
    }

    const { x0, x1 } = domain;
    const filteredData = completeHistory.filter((s) => {
      const x = s.time.getTime();
      return x >= x0 && x <= x1;
    });
    setData(filteredData);
  }, [completeHistory]);

  // set range handler
  const handleSetRange = useCallback((days: number | null) => {
    if(completeHistory.length === 0) {
      return;
    }

    if(days === null) {
      setData(completeHistory);
      brushRef.current!.reset();
    } else {
      // debugger;
      const lastEntry = completeHistory.at(-1)!;
      let startDate = new Date(data.at(-1) === lastEntry ? lastEntry.time : data.at(0)?.time ?? lastEntry.time);
      let endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + days);

      if(endDate > lastEntry.time) {
        endDate = new Date(lastEntry.time);
        startDate = new Date(lastEntry.time);
        startDate.setDate(startDate.getDate() - days);
      }

      const x0 = startDate.getTime();
      const x1 = endDate.getTime();

      const filteredData = completeHistory.filter((s) => {
        const x = s.time.getTime();
        return x >= x0 && x <= x1;
      });

      setData(filteredData);

      brushRef.current!.updateBrush((prevBrush) => {
        const newExtent = brushRef.current!.getExtent(
          { x: xBrushScale(filteredData.at(0)!.time) },
          { x: xBrushScale(filteredData.at(-1)!.time) }
        );

        ignoreNextChange.current = true;

        return {
          ...prevBrush,
          start: { y: newExtent.y0, x: newExtent.x0 },
          end: { y: newExtent.y1, x: newExtent.x1 },
          extent: newExtent,
        };
      });
    }
  }, [completeHistory, data, xBrushScale]);

  // get latest data point (shown in legend)
  const current = completeHistory.at(-1)!;

  return (
    <>
      <FlexRow wrap align="space-between">
        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          <ChartToggle checked={visibility.sellPrice} onChange={(sellPrice) => setVisibility({ ...visibility, sellPrice })} color={colors.sellPrice} label={labels.sellPrice}>
            {current.sellPrice ? (<Coins value={current.sellPrice}/>) : <span>-</span>}
          </ChartToggle>
          <ChartToggle checked={visibility.buyPrice} onChange={(buyPrice) => setVisibility({ ...visibility, buyPrice })} color={colors.buyPrice} label={labels.buyPrice}>
            {current.buyPrice ? (<Coins value={current.buyPrice}/>) : <span>-</span>}
          </ChartToggle>
          <ChartToggle checked={visibility.sellQuantity} onChange={(sellQuantity) => setVisibility({ ...visibility, sellQuantity })} color={colors.sellQuantity} dashed label={labels.sellQuantity}>
            <FormatNumber value={current.sellQuantity}/>
          </ChartToggle>
          <ChartToggle checked={visibility.buyQuantity} onChange={(buyQuantity) => setVisibility({ ...visibility, buyQuantity })} color={colors.buyQuantity} dashed label={labels.buyQuantity}>
            <FormatNumber value={current.buyQuantity}/>
          </ChartToggle>
        </div>
        <div>
          <FlexRow>
            <LinkButton appearance="menu" icon="diff" href={`/tradingpost/compare?ids=${completeHistory[0].itemId}`}>Compare</LinkButton>
            <DropDown button={<Button icon="settings">Settings</Button>}>
              <MenuList>
                <Checkbox checked={thresholdVisible} onChange={setThresholdVisible}>Highlight Supply/Demand Difference</Checkbox>
                <Checkbox checked={smoothCurve} onChange={setSmoothCurve}>Smooth Curve</Checkbox>
              </MenuList>
            </DropDown>
          </FlexRow>
        </div>
      </FlexRow>

      <div style={{ position: 'relative', overflow: 'hidden', margin: '32px -16px', padding: '0 16px' }}>
        <div style={{ marginBottom: 32 }}>
          <svg width={width} height={brushHeight + brushBorder * 2} viewBox={`0 0 ${width} ${brushHeight + brushBorder * 2}`} style={{ overflow: 'visible', userSelect: 'none' }}>
            <rect x={brushBorder / 2} y={brushBorder / 2} width={width - brushBorder} height={brushHeight + brushBorder} stroke="var(--color-border)" strokeWidth={brushBorder} rx={2} fill="none"/>
            <Group left={brushBorder} top={brushBorder} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round">
              <GridColumns scale={xBrushScale} width={width - brushBorder * 2} height={brushHeight} numTicks={10} stroke="var(--color-border)" strokeDasharray="4"/>

              {visibility.sellQuantity && (<LinePath data={completeHistory} y={(d) => quantityBrushScale(d.sellQuantity ?? 0)} x={(d) => xBrushScale(d.time)} curve={curve} stroke={colors.sellQuantity} strokeDasharray="2"/>)}
              {visibility.buyQuantity && (<LinePath data={completeHistory} y={(d) => quantityBrushScale(d.buyQuantity ?? 0)} x={(d) => xBrushScale(d.time)} curve={curve} stroke={colors.buyQuantity} strokeDasharray="2"/>)}

              {visibility.sellPrice && (<LinePath data={completeHistory} y={(d) => priceBrushScale(d.sellPrice ?? 0)} x={(d) => xBrushScale(d.time)} defined={(d) => !!d.sellPrice} curve={curve} stroke={colors.sellPrice}/>)}
              {visibility.buyPrice && (<LinePath data={completeHistory} y={(d) => priceBrushScale(d.buyPrice ?? 0)} x={(d) => xBrushScale(d.time)} defined={(d) => !!d.buyPrice} curve={curve} stroke={colors.buyPrice}/>)}
            </Group>
            <Group left={brushBorder / 2} top={brushBorder / 2}>
              <Brush
                xScale={xBrushScale}
                yScale={priceBrushScale}
                width={width - brushBorder}
                height={brushHeight + brushBorder}
                handleSize={8}
                innerRef={brushRef}
                resizeTriggerAreas={['left', 'right']}
                brushDirection="horizontal"
                initialBrushPosition={initialBrushPosition}
                onChange={handleBrushChange}
                onClick={() => setData(completeHistory)}
                selectedBoxStyle={{ fill: 'var(--color-focus)', fillOpacity: .1, stroke: 'var(--color-focus)', strokeWidth: brushBorder, rx: 2 }}
                useWindowMoveEvents/>
            </Group>
          </svg>
          <FlexRow align="space-between">
            <span>Showing <b style={{ fontFeatureSettings: '"tnum" 1' }}>{data.length > 0 ? Math.ceil((data.at(-1)!.time.getTime() - data.at(0)!.time.getTime()) / 1000 / 60 / 60 / 24) : 0} days</b> before <b style={{ fontFeatureSettings: '"tnum" 1' }}><FormatDate date={data.at(-1)?.time}/></b></span>
            <div>
              <FlexRow>
                <Button iconOnly appearance="menu" onClick={() => handleSetRange(null)}>Full History</Button>
                <Button iconOnly appearance="menu" onClick={() => handleSetRange(365)}>1 Year</Button>
                <Button iconOnly appearance="menu" onClick={() => handleSetRange(90)}>3 Months</Button>
                <Button iconOnly appearance="menu" onClick={() => handleSetRange(14)}>2 Weeks</Button>
              </FlexRow>
            </div>
          </FlexRow>
        </div>
        <div style={{ position: 'relative' }}>
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
            <Group left={dynamicMargin.left} top={margin.top}>
              {(visibility.sellPrice || visibility.buyPrice) ? (
                <GridRows scale={priceScale} width={xMax} height={yMax} numTicks={6} stroke="var(--color-border-dark)" strokeDasharray="4 4"/>
                ) : (visibility.sellQuantity || visibility.buyQuantity) && (
                  <GridRows scale={quantityScale} width={xMax} height={yMax} numTicks={6} stroke="var(--color-border-dark)" strokeDasharray="4 4"/>
              )}
              {/* <GridColumns scale={xScale} width={xMax} height={yMax} numTicks={width >= 1000 ? 10 : 6} stroke="var(--color-border)"/> */}

              {!isMobile && (
                <>
                  {(visibility.sellPrice || visibility.buyPrice) && (<AxisLeft scale={priceScale} strokeWidth={0} tickComponent={renderGoldTick} tickFormat={(v) => v.toString()} numTicks={6}/>)}
                  {(visibility.sellQuantity || visibility.buyQuantity) && (<AxisRight scale={quantityScale} left={xMax} strokeWidth={0} tickLabelProps={{ fill: 'var(--color-text)', fontFamily: 'var(--font-wotfard)', fontSize: 12 }} numTicks={6}/>)}
                </>
              )}

              <AxisBottom scale={xScale} top={yMax} stroke="var(--color-border)" strokeWidth={2} tickStroke="var(--color-border)" tickLabelProps={{ fill: 'var(--color-text)', fontFamily: 'var(--font-wotfard)', fontSize: 12 }} numTicks={width >= 1000 ? 10 : 6}/>

              <g strokeWidth={2} strokeLinejoin="round" strokeLinecap="round">
                {visibility.sellQuantity && visibility.buyQuantity && thresholdVisible && (
                  <Threshold id="quantity" data={data} x={x} y0={(d) => quantityScale(d.sellQuantity ?? 0)} y1={(d) => quantityScale(d.buyQuantity ?? 0)} clipAboveTo={0} clipBelowTo={yMax} curve={curve} aboveAreaProps={{ fill: colors.sellQuantity, fillOpacity: .08 }} belowAreaProps={{ fill: colors.buyQuantity, fillOpacity: .08 }}/>
                )}

                {visibility.sellQuantity && (<LinePath data={data} y={(d) => quantityScale(d.sellQuantity ?? 0)} x={x} curve={curve} stroke={colors.sellQuantity} strokeDasharray="4"/>)}
                {visibility.buyQuantity && (<LinePath data={data} y={(d) => quantityScale(d.buyQuantity ?? 0)} x={x} curve={curve} stroke={colors.buyQuantity} strokeDasharray="4"/>)}

                {visibility.sellPrice && (<LinePath data={data} y={(d) => priceScale(d.sellPrice ?? 0)} x={x} defined={(d) => !!d.sellPrice} curve={curve} stroke={colors.sellPrice}/>)}
                {visibility.buyPrice && (<LinePath data={data} y={(d) => priceScale(d.buyPrice ?? 0)} x={x} defined={(d) => !!d.buyPrice} curve={curve} stroke={colors.buyPrice}/>)}
              </g>
            </Group>

            {tooltipOpen && tooltipData && (
              <g>
                <Line
                  from={{ x: x(tooltipData) + dynamicMargin.left, y: margin.top }}
                  to={{ x: x(tooltipData) + dynamicMargin.left, y: yMax + margin.top }}
                  stroke="var(--color-border-dark)"
                  strokeWidth={1}
                  pointerEvents="none"
                  strokeDasharray="4 2"/>
                {visibility.sellQuantity && (
                  <Circle
                    cx={x(tooltipData) + dynamicMargin.left}
                    cy={quantityScale(tooltipData.sellQuantity ?? 0) + margin.top}
                    r={4}
                    fill={colors.sellQuantity}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.12))' }}
                    pointerEvents="none"/>
                )}
                {visibility.buyQuantity && (
                  <Circle
                    cx={x(tooltipData) + dynamicMargin.left}
                    cy={quantityScale(tooltipData.buyQuantity ?? 0) + margin.top}
                    r={4}
                    fill={colors.buyQuantity}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.12))' }}
                    pointerEvents="none"/>
                )}
                {visibility.sellPrice && tooltipData.sellPrice && (
                  <Circle
                    cx={x(tooltipData) + dynamicMargin.left}
                    cy={priceScale(tooltipData.sellPrice ?? 0) + margin.top}
                    r={4}
                    fill={colors.sellPrice}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.12))' }}
                    pointerEvents="none"/>
                )}
                {visibility.buyPrice && tooltipData.buyPrice && (
                  <Circle
                    cx={x(tooltipData) + dynamicMargin.left}
                    cy={priceScale(tooltipData.buyPrice ?? 0) + margin.top}
                    r={4}
                    fill={colors.buyPrice}
                    stroke="var(--color-background)"
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 0 4px rgba(0,0,0,0.12))' }}
                    pointerEvents="none"/>
                )}
              </g>
            )}

            <Bar
              x={dynamicMargin.left}
              y={margin.top}
              width={xMax}
              height={yMax}
              fill="transparent"
              onTouchStart={handleTooltip}
              onTouchMove={handleTooltip}
              onMouseMove={handleTooltip}
              onMouseLeave={() => hideTooltip()}/>
          </svg>

          {tooltipOpen && tooltipData && (
            <>
              <Tooltip
                // set this to random so it correctly updates with parent bounds
                key={Math.random()}
                top={yMax + margin.top - 4}
                left={(tooltipLeft ?? 0) + 8}
                applyPositionStyle
                className={tipStyles.tip}
                style={{ textAlign: 'center', transform: 'translateX(-50%)', minWidth: 72 }}
              >
                <FormatDate date={tooltipData?.time}/>
              </Tooltip>
              {(visibility.sellPrice || visibility.buyPrice || visibility.sellQuantity || visibility.buyQuantity) && (
                <TooltipWithBounds
                  // set this to random so it correctly updates with parent bounds
                  key={Math.random()}
                  top={tooltipTop}
                  left={(tooltipLeft ?? 0) + 16}
                  className={tipStyles.tip}
                  unstyled
                  applyPositionStyle
                >
                  <div className={styles.tooltip}>
                    {visibility.sellPrice && (
                      <div className={styles.tooltipLine} style={{ '--_color': colors.sellPrice }}>
                        <span className={styles.tooltipLineLabel}>{labels.sellPrice}:</span>
                        <span className={styles.tooltipLineValue}>{tooltipData.sellPrice ? (<Coins value={tooltipData?.sellPrice ?? 0}/>) : '-'}</span>
                      </div>
                    )}
                    {visibility.buyPrice && (
                      <div className={styles.tooltipLine} style={{ '--_color': colors.buyPrice }}>
                        <span className={styles.tooltipLineLabel}>{labels.buyPrice}:</span>
                        <span className={styles.tooltipLineValue}>{tooltipData.buyPrice ? (<Coins value={tooltipData.buyPrice}/>) : '-'}</span>
                      </div>
                    )}
                    {visibility.sellQuantity && (
                      <div className={styles.tooltipLine} style={{ '--_color': colors.sellQuantity }}>
                        <span className={styles.tooltipLineLabel}>{labels.sellQuantity}:</span>
                        <span className={styles.tooltipLineValue}><FormatNumber value={tooltipData?.sellQuantity ?? 0}/></span>
                      </div>
                    )}
                    {visibility.buyQuantity && (
                      <div className={styles.tooltipLine} style={{ '--_color': colors.buyQuantity }}>
                        <span className={styles.tooltipLineLabel}>{labels.buyQuantity}:</span>
                        <span className={styles.tooltipLineValue}><FormatNumber value={tooltipData?.buyQuantity ?? 0}/></span>
                      </div>
                    )}
                    {tooltipData.time < datawars2DataBefore && (
                      <span style={{ color: 'var(--color-text-muted)' }}>Historical data provided by datawars2.ie</span>
                    )}
                  </div>
                </TooltipWithBounds>
              )}
            </>
          )}
        </div>
      </div>

    </>
  );
};

function renderGoldTick(props: TickRendererProps) {
  return (
    <svg style={{ overflow: 'visible', fontFeatureSettings: '"tnum" 1' }} x="0" y="-.5em" fontSize={12} fontFamily="var(--font-wotfard)">
      <foreignObject x={props.x - 60 - 8} y={props.y} width={60} height="1em" style={{ textAlign: 'right' }}>
        <Coins value={Number(props.formattedValue)}/>
      </foreignObject>
    </svg>
  );
}

function estimateGoldTickLength(value: number) {
  const { gold, silver, copper } = coinsToGoldSilverCopper(value);

  return (
    // width of gold (14px circle + 8px per char)
    (gold > 0 ? 14 + gold.toString().length * 8 : 0) +
    (silver > 0 ? 14 + silver.toString().length * 8 : 0) +
    (copper > 0 || value === 0 ? 14 + copper.toString().length * 8 : 0) +
    // margin between two sizes
    (copper && silver || copper && gold || silver && copper ? 6 : 0) +
    // additional margin if all are set
    (copper && silver && gold ? 6 : 0)
    );
};

interface ChartToggleProps {
  label: ReactNode;
  children: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  color: string;
  dashed?: boolean;
}

const ChartToggle: FC<ChartToggleProps> = ({ label, children, checked, onChange, color, dashed }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const labelOnKeyDown: KeyboardEventHandler<HTMLLabelElement> = useCallback((e) => {
    if(e.key === 'Enter' || e.key === ' ') {
      inputRef.current?.click();
      e.preventDefault();
    }
  }, []);

  const handleToggle = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);

  return (
    <label className={checked ? styles.toggle : styles.toggleUnchecked} htmlFor={id} tabIndex={0} onKeyDown={labelOnKeyDown}>
      <input className={styles.toggleCheckbox} type="checkbox" checked={checked} id={id} onChange={handleToggle} ref={inputRef}/>
      <svg className={styles.toggleBorder} viewBox="0 0 1 7" preserveAspectRatio="none"><path d="M0,0 L0,7" strokeWidth={4} stroke={checked ? color : 'var(--color-border-dark)'} strokeDasharray={dashed ? '1.2 0.8' : undefined}/></svg>
      <div className={styles.toggleLabel}>{label}</div>
      <div className={styles.toggleValue}>{children}</div>
    </label>
  );
};
