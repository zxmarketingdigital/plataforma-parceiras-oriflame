import type { ScenarioKey, Scenario } from "./types";
import styles from "./DiagnosticChat.module.css";

interface ScenarioChartProps {
  scenarios: Record<ScenarioKey, Scenario>;
  labels: Record<ScenarioKey, string>;
}

const scenarioOrder: ScenarioKey[] = ["conservador", "provavel", "ambicioso"];

export function ScenarioChart({ scenarios, labels }: ScenarioChartProps) {
  const series = scenarioOrder.map((key) => ({ key, values: scenarios[key].monthly }));

  const maxValue = Math.max(1, ...series.flatMap((item) => item.values));
  const width = 620;
  const height = 250;
  const padding = { top: 18, right: 12, bottom: 18, left: 12 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const pointString = (values: number[]) => values.map((value, index) => {
    const x = padding.left + (graphWidth / 11) * index;
    const y = padding.top + graphHeight - (value / maxValue) * graphHeight;
    return `${x},${y}`;
  }).join(" ");

  return (
    <div className={styles.chartWrap}>
      <svg className={styles.chart} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        {[0.25, 0.5, 0.75].map((ratio) => <line key={ratio} className={styles.chartGrid} x1={padding.left} x2={width - padding.right} y1={padding.top + graphHeight * ratio} y2={padding.top + graphHeight * ratio} />)}
        {series.map(({ key, values }) => <polyline key={key} className={`${styles.chartLine} ${styles[`chart${key}`]}`} points={pointString(values)} vectorEffect="non-scaling-stroke" />)}
      </svg>
      <ul className={styles.chartLegend}>
        {scenarioOrder.map((key) => (
          <li key={key}><span className={`${styles.legendLine} ${styles[`legend${key}`]}`} aria-hidden="true" />{labels[key]}</li>
        ))}
      </ul>
    </div>
  );
}
