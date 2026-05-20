import { ChartOptions, Scale, TooltipItem } from 'chart.js';
import { getStyle } from '@coreui/utils';

export const OOREDDOO_CHART_COLORS = {
  primaryRed: '#E30613',
  deepRed: '#B00020',
  softRedBackground: '#FFF1F2',
  criticalRed: '#DC2626',
  warningOrange: '#F59E0B',
  successGreen: '#16A34A',
  infoBlue: '#2563EB',
  purple: '#7C3AED',
  darkText: '#111827',
  mutedText: '#6B7280',
  border: '#E5E7EB',
  pageBackground: '#F8FAFC',
  cardBackground: '#FFFFFF',
  neutralGray: '#9CA3AF'
} as const;

export const OOREDDOO_SOURCE_COLOR_MAP: Record<string, string> = {
  MES: OOREDDOO_CHART_COLORS.primaryRed,
  MSE: OOREDDOO_CHART_COLORS.primaryRed,
  ACTIVATION: OOREDDOO_CHART_COLORS.primaryRed,
  DMG: OOREDDOO_CHART_COLORS.infoBlue,
  DEMENAGEMENT: OOREDDOO_CHART_COLORS.infoBlue,
  PLT: OOREDDOO_CHART_COLORS.warningOrange,
  PLAINTE: OOREDDOO_CHART_COLORS.warningOrange,
  RES: OOREDDOO_CHART_COLORS.purple,
  RESILIATION: OOREDDOO_CHART_COLORS.purple
};

export const OOREDDOO_SLA_COLOR_MAP: Record<string, string> = {
  IN_SLA: OOREDDOO_CHART_COLORS.successGreen,
  OUT_OF_SLA: OOREDDOO_CHART_COLORS.criticalRed,
  UNKNOWN: OOREDDOO_CHART_COLORS.neutralGray
};

export const OOREDDOO_STATUS_COLOR_MAP: Record<string, string> = {
  TERMINE: OOREDDOO_CHART_COLORS.successGreen,
  EN_COURS: OOREDDOO_CHART_COLORS.infoBlue,
  GELE_BLOQUE: OOREDDOO_CHART_COLORS.warningOrange,
  REJETE_FAILED: OOREDDOO_CHART_COLORS.criticalRed,
  OTHER: OOREDDOO_CHART_COLORS.neutralGray
};

type BarOptionsInput = {
  horizontal?: boolean;
  tooltipFormatter?: (value: number, label: string) => string;
  maxTicksLimit?: number;
};

type DonutOptionsInput = {
  tooltipFormatter?: (label: string, value: number, total: number) => string;
};

type TrendOptionsInput = {
  tooltipFormatter?: (value: number, label: string) => string;
};

export const OOREDDOO_BASE_CHART_OPTIONS = {
  animation: {
    duration: 320
  },
  interaction: {
    intersect: false,
    mode: 'index' as const
  },
  maintainAspectRatio: false,
  responsive: true
};

export function withAlpha(hexColor: string, alpha: number): string {
  if (!hexColor.startsWith('#') || (hexColor.length !== 7 && hexColor.length !== 4)) {
    return hexColor;
  }

  const normalized = hexColor.length === 4
    ? `#${hexColor[1]}${hexColor[1]}${hexColor[2]}${hexColor[2]}${hexColor[3]}${hexColor[3]}`
    : hexColor;

  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function getSourceColor(source: string | null | undefined): string {
  const normalized = normalizeKey(source);

  if (normalized.includes('MES') || normalized.includes('MSE') || normalized.includes('ACTIVATION')) {
    return OOREDDOO_CHART_COLORS.primaryRed;
  }

  if (normalized.includes('DMG') || normalized.includes('DEMENAGEMENT')) {
    return OOREDDOO_CHART_COLORS.infoBlue;
  }

  if (normalized.includes('PLT') || normalized.includes('PLAINTE')) {
    return OOREDDOO_CHART_COLORS.warningOrange;
  }

  if (normalized.includes('RES') || normalized.includes('RESILIATION')) {
    return OOREDDOO_CHART_COLORS.purple;
  }

  return OOREDDOO_CHART_COLORS.neutralGray;
}

export function getStatusColor(status: string | null | undefined): string {
  const normalized = normalizeKey(status);

  if (normalized.includes('TERMINE') || normalized.includes('COMPLET')) {
    return OOREDDOO_CHART_COLORS.successGreen;
  }

  if (normalized.includes('EN COURS') || normalized.includes('IN PROGRESS')) {
    return OOREDDOO_CHART_COLORS.infoBlue;
  }

  if (normalized.includes('GELE') || normalized.includes('BLOQUE')) {
    return OOREDDOO_CHART_COLORS.warningOrange;
  }

  if (normalized.includes('REJETE') || normalized.includes('FAILED') || normalized.includes('ECHEC')) {
    return OOREDDOO_CHART_COLORS.criticalRed;
  }

  return OOREDDOO_CHART_COLORS.neutralGray;
}

export function getSlaColor(label: string | null | undefined): string {
  const normalized = normalizeKey(label);

  if (normalized.includes('IN SLA')) {
    return OOREDDOO_CHART_COLORS.successGreen;
  }

  if (normalized.includes('OUT OF SLA')) {
    return OOREDDOO_CHART_COLORS.criticalRed;
  }

  return OOREDDOO_CHART_COLORS.neutralGray;
}

export function buildDonutChartOptions(input: DonutOptionsInput = {}): ChartOptions<'doughnut'> {
  const textColor = resolveTextColor();

  return {
    ...OOREDDOO_BASE_CHART_OPTIONS,
    cutout: '64%',
    plugins: {
      legend: {
        display: true,
        position: 'bottom',
        labels: {
          boxHeight: 10,
          boxWidth: 10,
          color: textColor,
          padding: 16,
          useBorderRadius: true
        }
      },
      tooltip: {
        backgroundColor: OOREDDOO_CHART_COLORS.darkText,
        borderColor: withAlpha('#FFFFFF', 0.14),
        borderWidth: 1,
        bodyColor: OOREDDOO_CHART_COLORS.pageBackground,
        padding: 12,
        titleColor: OOREDDOO_CHART_COLORS.cardBackground,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (context) => {
            const value = Number(context.raw ?? 0);
            const data = context.dataset.data as number[] | undefined;
            const total = (data ?? []).reduce((sum, current) => sum + Number(current ?? 0), 0);

            if (input.tooltipFormatter) {
              return input.tooltipFormatter(context.label ?? '', value, total);
            }

            const percentage = total > 0 ? (value / total) * 100 : 0;
            return `${formatMetric(value)} row(s) - ${formatMetric(percentage)}%`;
          }
        }
      }
    }
  };
}

export function buildBarChartOptions(input: BarOptionsInput = {}): ChartOptions<'bar'> {
  const horizontal = input.horizontal ?? false;
  const borderColor = resolveGridColor();
  const textColor = resolveTextColor();

  return {
    ...OOREDDOO_BASE_CHART_OPTIONS,
    indexAxis: horizontal ? 'y' : 'x',
    layout: {
      padding: {
        right: horizontal ? 8 : 0
      }
    },
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: OOREDDOO_CHART_COLORS.darkText,
        borderColor: withAlpha('#FFFFFF', 0.14),
        borderWidth: 1,
        bodyColor: OOREDDOO_CHART_COLORS.pageBackground,
        displayColors: false,
        padding: 12,
        titleColor: OOREDDOO_CHART_COLORS.cardBackground,
        callbacks: {
          title: (items: TooltipItem<'bar'>[]) => items[0]?.label ?? '',
          label: (context: TooltipItem<'bar'>) => {
            const value = Number(context.raw ?? 0);
            const label = String(context.label ?? '');
            return input.tooltipFormatter ? input.tooltipFormatter(value, label) : formatMetric(value);
          }
        }
      }
    },
    scales: horizontal
      ? {
          x: {
            beginAtZero: true,
            border: {
              display: false
            },
            grid: {
              color: borderColor,
              drawTicks: false
            },
            ticks: {
              color: textColor,
              maxTicksLimit: input.maxTicksLimit ?? 6
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              display: false
            },
            ticks: {
              autoSkip: false,
              color: OOREDDOO_CHART_COLORS.mutedText,
              font: {
                size: 11,
                weight: 500
              },
              callback(this: Scale, tickValue: number | string): string {
                const label = this.getLabelForValue(Number(tickValue));
                return label.length > 22 ? `${label.substring(0, 20)}…` : label;
              }
            }
          }
        }
      : {
          x: {
            border: {
              display: false
            },
            grid: {
              display: false
            },
            ticks: {
              color: textColor
            }
          },
          y: {
            beginAtZero: true,
            border: {
              display: false
            },
            grid: {
              color: borderColor,
              drawTicks: false
            },
            ticks: {
              color: textColor,
              maxTicksLimit: input.maxTicksLimit ?? 5
            }
          }
        }
  };
}

export function buildTrendChartOptions(input: TrendOptionsInput = {}): ChartOptions<'line'> {
  const borderColor = resolveGridColor();
  const textColor = resolveTextColor();

  return {
    ...OOREDDOO_BASE_CHART_OPTIONS,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: OOREDDOO_CHART_COLORS.darkText,
        borderColor: withAlpha('#FFFFFF', 0.14),
        borderWidth: 1,
        bodyColor: OOREDDOO_CHART_COLORS.pageBackground,
        displayColors: false,
        padding: 12,
        titleColor: OOREDDOO_CHART_COLORS.cardBackground,
        callbacks: {
          title: (items) => items[0]?.label ?? '',
          label: (context) => {
            const value = Number(context.raw ?? 0);
            const label = String(context.label ?? '');
            return input.tooltipFormatter ? input.tooltipFormatter(value, label) : `${formatMetric(value)} row(s)`;
          }
        }
      }
    },
    scales: {
      x: {
        border: {
          display: false
        },
        grid: {
          display: false
        },
        ticks: {
          color: textColor
        }
      },
      y: {
        beginAtZero: true,
        border: {
          display: false
        },
        grid: {
          color: borderColor,
          drawTicks: false
        },
        ticks: {
          color: textColor,
          maxTicksLimit: 5
        }
      }
    },
    elements: {
      line: {
        borderJoinStyle: 'round',
        tension: 0.35
      },
      point: {
        hitRadius: 10,
        hoverRadius: 5,
        radius: 0
      }
    }
  };
}

function resolveGridColor(): string {
  return getStyle('--cui-border-color-translucent') ?? withAlpha(OOREDDOO_CHART_COLORS.darkText, 0.08);
}

function resolveTextColor(): string {
  return getStyle('--cui-body-color') ?? OOREDDOO_CHART_COLORS.darkText;
}

function normalizeKey(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .toUpperCase();
}

function formatMetric(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString('en-US')
    : value.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
