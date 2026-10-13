/**
 * @lo-fi-rocket/ui: the building blocks of the redesigned app
 * (docs/ui/redesign.md). Display only: no physics, no calculation, no
 * import from @lo-fi-rocket/physics or @lo-fi-rocket/formats. Components
 * show the values they are given, formatted by `format/display-rules.ts`.
 *
 * Styles: import '@lo-fi-rocket/ui/tokens.css' and '@lo-fi-rocket/ui/styles.css' once.
 */
export {
  AppShell,
  StatusItem,
  type AppShellProps,
  type StatusItemProps,
} from './components/AppShell.js';
export { Button, type ButtonProps, type ButtonVariant } from './components/Button.js';
export { Dialog, type DialogProps } from './components/Dialog.js';
export { Dock, type DockItem, type DockProps } from './components/Dock.js';
export {
  arcPath,
  Gauge,
  gaugePosition,
  type GaugePosition,
  type GaugeProps,
  type GaugeZone,
} from './components/Gauge.js';
export {
  Field,
  SelectField,
  TextField,
  type FieldControlProps,
  type FieldProps,
  type SelectFieldProps,
  type SelectOption,
  type TextFieldProps,
} from './components/Field.js';
export { FileButton, type FileButtonProps } from './components/FileButton.js';
export { Icon, type IconName } from './components/Icon.js';
export { Meter, type MeterProps, type MeterTick } from './components/Meter.js';
export { NumberInput, type NumberInputProps, type NumberRule } from './components/NumberInput.js';
export { Panel, type PanelProps } from './components/Panel.js';
export { ResultCard, ResultGrid, type ResultCardProps } from './components/ResultCard.js';
export { Segmented, type SegmentedOption, type SegmentedProps } from './components/Segmented.js';
export {
  SEVERITY_LABEL,
  SEVERITY_ORDER,
  SeverityTag,
  StatusIcon,
  type Severity,
  type StatusIconProps,
} from './components/severity.js';
export {
  StabilityIndicator,
  type StabilityIndicatorProps,
  type StabilityLevel,
  type StabilityPoint,
  type StabilityThresholds,
} from './components/StabilityIndicator.js';
export {
  StepGuide,
  type Step,
  type StepGuideProps,
  type StepStatus,
} from './components/StepGuide.js';
export { Tabs, type TabItem, type TabsProps } from './components/Tabs.js';
export {
  Term,
  Tooltip,
  type TermProps,
  type TooltipProps,
  type TooltipTriggerProps,
} from './components/Tooltip.js';
export { VisuallyHidden } from './components/VisuallyHidden.js';
export {
  WarningBanner,
  WarningCounts,
  WarningList,
  WarningSummary,
  type WarningBannerProps,
  type WarningItem,
  type WarningListProps,
  type WarningSeverity,
  type WarningSummaryProps,
} from './components/Warnings.js';
export {
  editText,
  FIGURE_DISPLAY,
  formatFigure,
  formatFixed,
  formatQuantity,
  isDisplayable,
  parseNumber,
  UNIT_DISPLAY,
  withUnit,
  type DisplayRule,
  type FigureKind,
  type FigureRule,
  type QuantityKind,
  type UnitSystem,
} from './format/display-rules.js';
export { GLOSSARY, type GlossaryEntry, type GlossaryKey } from './glossary/glossary.js';
export {
  COLOURS,
  CONTRAST_PAIRS,
  cssVariable,
  RADIUS,
  SPACE,
  TYPE,
  type ColourTokens,
  type ThemeName,
} from './tokens/tokens.js';
