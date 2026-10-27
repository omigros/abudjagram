import type { AppMode, ElectronBridge, TrayIcon } from '../electronBridge';
import type {
  AnimationEasing, AuroraPalette, BackdropKind, CustomizationSettings, FontPreset, GradientKind, MessageAppearance,
} from '../settings';

import { getCanUseBackgroundMaterial, removeBackdropVideo, saveBackdropVideo } from '../applyCustomization';
import { IS_TRANSPARENT_WINDOW } from '../electronBridge';
import { ACCENT_PRESETS, MAX_GRADIENT_COLORS, MIN_GRADIENT_COLORS } from '../palette';
import { applyThemePreset, THEME_PRESETS } from '../presets';
import {
  exportCustomization,
  getCustomization,
  importCustomization,
  resetCustomization,
  subscribeToCustomization,
  updateCustomization,
} from '../settings';

import './panel.scss';

type Option<T extends string> = [T, string, string?];

// The panel lives inside the official Telegram Web, outside its localization, so the texts live here
const PRESET_NAMES: Record<string, string> = {
  aurora: 'Аврора', sunset: 'Закат', ocean: 'Океан', neon: 'Неон', terminal: 'Терминал', classic: 'Классика',
};
const BACKDROP_OPTIONS: Option<BackdropKind>[] = [
  ['telegram', 'Обои Telegram'],
  ['aurora', 'Аврора', 'Анимированный градиент'],
  ['gradient', 'Свой градиент', 'Свои цвета, тип и зернистость'],
  ['video', 'Видео'],
];
const PALETTE_OPTIONS: Option<AuroraPalette>[] = [
  ['aurora', 'Северное сияние'], ['sunset', 'Закат'], ['ocean', 'Океан'], ['neon', 'Неон'],
];
const GRADIENT_KIND_OPTIONS: Option<GradientKind>[] = [
  ['mesh', 'Сетка из пятен'], ['linear', 'Линейный'], ['radial', 'Радиальный'],
];
const FONT_OPTIONS: Option<FontPreset>[] = [
  ['default', 'Стандартный (Roboto)'], ['system', 'Системный (Segoe UI)'], ['inter', 'Inter'],
  ['manrope', 'Manrope'], ['nunito', 'Nunito'], ['jetbrains', 'JetBrains Mono'], ['custom', 'Другой шрифт из системы'],
];
const EASING_OPTIONS: Option<AnimationEasing>[] = [
  ['default', 'Стандартный'], ['smooth', 'Плавный'], ['bouncy', 'Пружинистый'], ['snappy', 'Резкий'],
];
const APPEARANCE_OPTIONS: Option<MessageAppearance>[] = [
  ['default', 'Стандартное'], ['fade', 'Растворение'], ['slide', 'Выезд снизу'], ['pop', 'Всплытие'],
  ['blur', 'Из размытия'],
];
const MODE_OPTIONS: Option<AppMode>[] = [
  ['web', 'Официальный Telegram Web', 'Вход без своих ключей API'],
  ['local', 'Своя сборка', 'Нужны ключи с my.telegram.org'],
];
const GLASS_TINT_PRESETS = ['#FFFFFF', '#17171C', '#1E1B2E', '#0F2A2E', '#2E1A24', '#F3E9FF'];
const NEW_GRADIENT_COLOR = '#FFD166';
const DEFAULT_COLOR_LABEL = 'Как в теме';
const NATIVE_MATERIAL_HINT = 'Системный материал Windows 11';
const EXPORT_FILENAME = 'abudjagram-theme.json';
const TOGGLE_SHORTCUT_KEY = 'K';
const PALETTE_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0 '
  + '0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1.1.9-2 2-2h2.4A5.6 5.6 0 0 0 22 9.8C22 5.5 17.5 2 '
  + '12 2Zm-5.5 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm5 0a1.5 1.5 0 1 1 '
  + '0-3 1.5 1.5 0 0 1 0 3Zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z"/></svg>';

let panel: HTMLDivElement | undefined;
let body: HTMLDivElement | undefined;
let bridge: ElectronBridge;
let isAutoLaunchEnabled: boolean | undefined;
let wantedMode: AppMode;
let isTransparentWindowWanted = IS_TRANSPARENT_WINDOW;
let cssDraft: string | undefined;
let isDraggingSlider = false;
let trayIcons: TrayIcon[] | undefined;
let appIcons: TrayIcon[] | undefined;

export function initPanel(electronBridge: ElectronBridge) {
  bridge = electronBridge;
  wantedMode = bridge.appMode;
  void bridge.getAutoLaunch().then((isEnabled) => {
    isAutoLaunchEnabled = isEnabled;
    render();
  });
  void bridge.getTrayIcons().then((icons) => {
    trayIcons = icons;
    render();
  });
  void bridge.getAppIcons().then((icons) => {
    appIcons = icons;
    render();
  });

  renderToggleButton();
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key.toUpperCase() === TOGGLE_SHORTCUT_KEY) {
      e.preventDefault();
      togglePanel();
    }
  });

  // Structural changes re-render the panel; slider drags update their own labels instead
  subscribeToCustomization(() => {
    if (!isDraggingSlider) render();
  });
}

function renderToggleButton() {
  const button = el('button', 'abj-panel-toggle');
  button.type = 'button';
  button.title = 'Кастомизация (Ctrl+Shift+K)';
  button.innerHTML = PALETTE_ICON;
  button.addEventListener('click', togglePanel);
  document.documentElement.append(button);
}

function togglePanel() {
  if (panel) {
    panel.remove();
    panel = undefined;
    body = undefined;
    return;
  }

  panel = el('div', 'abj-panel');
  const header = el('div', 'abj-panel-header');
  header.append(el('div', 'abj-panel-title', 'Кастомизация'));
  const close = el('button', 'abj-panel-close', '✕');
  close.addEventListener('click', togglePanel);
  header.append(close);
  body = el('div', 'abj-panel-body');
  panel.append(header, body);
  document.documentElement.append(panel);
  render();
}

function render() {
  if (!body) return;

  const scrollTop = body.scrollTop;
  const settings = getCustomization();
  body.replaceChildren(
    renderPresets(settings),
    section('Акцентный цвет', [
      swatches(ACCENT_PRESETS, settings.accentColor, DEFAULT_COLOR_LABEL, (color) => {
        updateCustomization({ accentColor: color });
      }),
      checkbox('Красить свои сообщения в акцент', Boolean(settings.isOwnBubbleTinted), (isChecked) => {
        updateCustomization({ isOwnBubbleTinted: isChecked || undefined });
      }, !settings.accentColor),
    ]),
    section('Стекло', [
      checkbox('Эффект стекла', settings.isGlassEnabled, (isChecked) => {
        updateCustomization({ isGlassEnabled: isChecked });
      }),
      slider('Размытие', 0, 60, 1, settings.glassBlur, (v) => `${v} px`, (v) => ({ glassBlur: v })),
      slider('Плотность панелей', 10, 95, 1, settings.glassOpacity, (v) => `${v}%`, (v) => ({ glassOpacity: v })),
      slider('Насыщенность', 100, 220, 10, settings.glassSaturation, (v) => `${v}%`, (v) => ({ glassSaturation: v })),
      checkbox('Светлая кромка панелей', settings.hasGlassHighlight, (isChecked) => {
        updateCustomization({ hasGlassHighlight: isChecked });
      }),
      checkbox('Стеклянные пузыри сообщений', Boolean(settings.isGlassBubbles), (isChecked) => {
        updateCustomization({ isGlassBubbles: isChecked || undefined });
      }),
      subheader('Оттенок стекла'),
      swatches(GLASS_TINT_PRESETS, settings.glassTint, DEFAULT_COLOR_LABEL, (color) => {
        updateCustomization({ glassTint: color });
      }),
    ]),
    renderBackdrop(settings),
    section('Сообщения', [
      slider('Скругление пузырей', 0, 24, 1, settings.bubbleRadius, (v) => `${v} px`, (v) => ({ bubbleRadius: v })),
      checkbox('Хвостики у пузырей', settings.hasBubbleTails, (isChecked) => {
        updateCustomization({ hasBubbleTails: isChecked });
      }),
    ]),
    section('Шрифт', [
      radios('font', FONT_OPTIONS, settings.fontPreset, (value) => updateCustomization({ fontPreset: value })),
      ...(settings.fontPreset === 'custom' ? [textInput('Название шрифта', settings.customFontFamily || '', (value) => {
        updateCustomization({ customFontFamily: value.trim() || undefined });
      })] : []),
      slider('Масштаб интерфейса', 80, 130, 5, settings.uiScale, (v) => `${v}%`, (v) => ({ uiScale: v })),
    ]),
    section('Анимации', [
      slider('Длительность анимаций', 50, 200, 10, Math.round(settings.animationSpeed * 100),
        (v) => `${(v / 100).toFixed(1)}×`, (v) => ({ animationSpeed: v / 100 })),
      subheader('Характер движения'),
      radios('easing', EASING_OPTIONS, settings.animationEasing, (value) => {
        updateCustomization({ animationEasing: value });
      }),
      subheader('Появление сообщений'),
      radios('appearance', APPEARANCE_OPTIONS, settings.messageAppearance, (value) => {
        updateCustomization({ messageAppearance: value });
      }),
    ]),
    renderCustomCss(settings),
    renderApp(),
    section('Настройки', [
      action('Экспортировать в файл', handleExport),
      action('Импортировать из файла', handleImport),
      action('Сбросить всё', handleReset, true),
    ]),
  );
  body.scrollTop = scrollTop;
}

function renderPresets(settings: CustomizationSettings) {
  const grid = el('div', 'abj-panel-presets');
  THEME_PRESETS.forEach((preset) => {
    const tile = el('button', 'abj-panel-preset');
    const preview = el('span', 'abj-panel-preset-preview');
    preview.style.background = preset.preview;
    tile.append(preview, el('span', undefined, PRESET_NAMES[preset.id]));
    tile.addEventListener('click', () => updateCustomization(applyThemePreset(settings, preset)));
    grid.append(tile);
  });
  return section('Готовые темы', [grid]);
}

function renderBackdrop(settings: CustomizationSettings) {
  const options = BACKDROP_OPTIONS.slice();
  if (IS_TRANSPARENT_WINDOW) options.push(['transparent', 'Рабочий стол', 'Сквозь окно виден рабочий стол']);
  if (getCanUseBackgroundMaterial()) {
    options.push(['mica', 'Mica', NATIVE_MATERIAL_HINT], ['acrylic', 'Acrylic', NATIVE_MATERIAL_HINT]);
  }

  const { backdrop } = settings;
  const hasCustomBackdrop = backdrop === 'aurora' || backdrop === 'gradient' || backdrop === 'video';
  const children: HTMLElement[] = [
    radios('backdrop', options, backdrop, (value) => updateCustomization({ backdrop: value })),
  ];

  if (hasCustomBackdrop) {
    children.push(
      slider('Затемнение фона', 0, 80, 1, settings.backdropDim, (v) => `${v}%`, (v) => ({ backdropDim: v })),
      slider('Зернистость', 0, 100, 1, settings.grain, (v) => `${v}%`, (v) => ({ grain: v })),
    );
  }
  if (backdrop === 'transparent') {
    children.push(slider('Плотность фона окна', 0, 95, 1, settings.transparentTint, (v) => `${v}%`,
      (v) => ({ transparentTint: v })));
  }
  if (backdrop === 'aurora') {
    children.push(subheader('Палитра'), radios('palette', PALETTE_OPTIONS, settings.auroraPalette, (value) => {
      updateCustomization({ auroraPalette: value });
    }));
  }
  if (backdrop === 'gradient') children.push(...renderGradient(settings));
  if (backdrop === 'video') children.push(...renderVideo(settings));

  return section('Фон окна', children);
}

function renderGradient(settings: CustomizationSettings) {
  const { gradientColors } = settings;
  const row = el('div', 'abj-panel-gradient');
  const preview = el('div', 'abj-panel-gradient-preview');
  preview.style.background = `linear-gradient(90deg, ${gradientColors.join(', ')})`;
  row.append(preview);

  gradientColors.forEach((color, index) => {
    row.append(colorInput(color, (value) => {
      const next = gradientColors.slice();
      next[index] = value;
      updateCustomization({ gradientColors: next });
    }));
  });
  if (gradientColors.length < MAX_GRADIENT_COLORS) {
    row.append(roundButton('+', 'Добавить цвет', () => {
      updateCustomization({ gradientColors: [...gradientColors, NEW_GRADIENT_COLOR] });
    }));
  }
  if (gradientColors.length > MIN_GRADIENT_COLORS) {
    row.append(roundButton('−', 'Убрать цвет', () => {
      updateCustomization({ gradientColors: gradientColors.slice(0, -1) });
    }));
  }

  const children: HTMLElement[] = [
    subheader('Градиент'),
    row,
    radios('gradient-kind', GRADIENT_KIND_OPTIONS, settings.gradientKind, (value) => {
      updateCustomization({ gradientKind: value });
    }),
  ];
  if (settings.gradientKind === 'linear') {
    children.push(slider('Угол', 0, 360, 15, settings.gradientAngle, (v) => `${v}°`, (v) => ({ gradientAngle: v })));
  }
  if (settings.gradientKind === 'mesh') {
    children.push(checkbox('Анимировать', settings.isGradientAnimated, (isChecked) => {
      updateCustomization({ isGradientAnimated: isChecked });
    }));
  }
  return children;
}

function renderVideo(settings: CustomizationSettings) {
  const children: HTMLElement[] = [action('Выбрать видеофайл', () => {
    pickFile('video/mp4,video/webm', async (file) => {
      await saveBackdropVideo(file);
      updateCustomization({ backdrop: 'video', hasVideoFile: true });
    });
  })];

  if (settings.hasVideoFile) {
    children.push(action('Убрать видеофайл', async () => {
      await removeBackdropVideo();
      updateCustomization({ hasVideoFile: undefined });
    }, true));
  } else {
    children.push(textInput('Или ссылка на видео (https://…)', settings.videoUrl || '', (value) => {
      updateCustomization({ videoUrl: value.trim() || undefined });
    }));
  }
  return children;
}

function renderCustomCss(settings: CustomizationSettings) {
  const textarea = el('textarea', 'abj-panel-css');
  textarea.value = cssDraft ?? settings.customCss;
  textarea.placeholder = '.Message .message-content {\n  border-radius: 0.5rem;\n}';
  textarea.spellcheck = false;
  textarea.addEventListener('input', () => {
    cssDraft = textarea.value;
  });

  const apply = el('button', 'abj-panel-button', 'Применить CSS');
  apply.addEventListener('click', () => {
    updateCustomization({ customCss: textarea.value });
    cssDraft = undefined;
  });
  return section('Свой CSS', [textarea, apply]);
}

function renderApp() {
  const children: HTMLElement[] = [
    subheader('Режим'),
    radios('mode', MODE_OPTIONS, wantedMode, (value) => {
      wantedMode = value;
      bridge.setAppMode(value);
      render();
    }),
  ];

  if (appIcons?.length) {
    children.push(subheader('Значок приложения (окно, рабочий стол, «Пуск»)'), renderIconGrid(appIcons, (id) => {
      bridge.setAppIcon(id);
      appIcons = selectIcon(appIcons!, id);
    }));
  }
  if (trayIcons?.length) {
    children.push(subheader('Значок в трее'), renderIconGrid(trayIcons, (id) => {
      bridge.setTrayIcon(id);
      trayIcons = selectIcon(trayIcons!, id);
    }));
  }

  if (bridge.titleBarHeight) {
    children.push(checkbox('Прозрачное окно', isTransparentWindowWanted, (isChecked) => {
      isTransparentWindowWanted = isChecked;
      bridge.setTransparentWindow(isChecked);
      // The see-through backdrop is the point of the mode, so it is picked right away
      if (isChecked) {
        updateCustomization({ backdrop: 'transparent' });
      } else {
        render();
      }
    }));
  }
  children.push(checkbox('Запускать вместе с Windows', Boolean(isAutoLaunchEnabled), (isChecked) => {
    isAutoLaunchEnabled = isChecked;
    bridge.setAutoLaunch(isChecked);
  }, isAutoLaunchEnabled === undefined));

  if (wantedMode !== bridge.appMode || isTransparentWindowWanted !== IS_TRANSPARENT_WINDOW) {
    children.push(action('Перезапустить, чтобы применить', () => bridge.relaunch()));
  }
  return section('Приложение', children);
}

function renderIconGrid(icons: TrayIcon[], onSelect: (id: string) => void) {
  const grid = el('div', 'abj-panel-tray-icons');
  icons.forEach((icon) => {
    const button = el('button', `abj-panel-tray-icon${icon.isSelected ? ' abj-panel-tray-icon-selected' : ''}`);
    button.title = icon.name;
    const image = el('img');
    image.src = icon.dataUrl;
    image.alt = icon.name;
    button.append(image);
    button.addEventListener('click', () => {
      onSelect(icon.id);
      render();
    });
    grid.append(button);
  });
  return grid;
}

function selectIcon(icons: TrayIcon[], id: string) {
  return icons.map((icon) => ({ ...icon, isSelected: icon.id === id }));
}

function handleExport() {
  const url = URL.createObjectURL(new Blob([exportCustomization()], { type: 'application/json' }));
  const link = el('a');
  link.href = url;
  link.download = EXPORT_FILENAME;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url));
}

function handleImport() {
  pickFile('application/json,.json', async (file) => {
    try {
      importCustomization(await file.text());
      cssDraft = undefined;
    } catch (err) {
      window.alert('Не удалось прочитать файл настроек');
    }
  });
}

async function handleReset() {
  await removeBackdropVideo();
  cssDraft = undefined;
  resetCustomization();
}

function section(title: string, children: HTMLElement[]) {
  const root = el('section', 'abj-panel-section');
  root.append(el('div', 'abj-panel-section-title', title));
  const card = el('div', 'abj-panel-card');
  card.append(...children);
  root.append(card);
  return root;
}

function subheader(text: string) {
  return el('div', 'abj-panel-subheader', text);
}

function checkbox(label: string, isChecked: boolean, onChange: (isChecked: boolean) => void, isDisabled?: boolean) {
  const root = el('label', 'abj-panel-row abj-panel-check');
  const input = el('input');
  input.type = 'checkbox';
  input.checked = isChecked;
  input.disabled = Boolean(isDisabled);
  input.addEventListener('change', () => onChange(input.checked));
  root.append(input, el('span', undefined, label));
  return root;
}

function radios<T extends string>(name: string, options: Option<T>[], selected: T, onChange: (value: T) => void) {
  const root = el('div', 'abj-panel-radios');
  options.forEach(([value, label, subLabel]) => {
    const row = el('label', 'abj-panel-row abj-panel-radio');
    const input = el('input');
    input.type = 'radio';
    input.name = `abj-${name}`;
    input.checked = value === selected;
    input.addEventListener('change', () => onChange(value));
    const text = el('span', 'abj-panel-radio-text');
    text.append(el('span', undefined, label));
    if (subLabel) text.append(el('span', 'abj-panel-hint', subLabel));
    row.append(input, text);
    root.append(row);
  });
  return root;
}

function slider(
  label: string,
  min: number,
  max: number,
  step: number,
  value: number,
  format: (value: number) => string,
  toUpdate: (value: number) => Partial<CustomizationSettings>,
) {
  const root = el('div', 'abj-panel-slider');
  const valueLabel = el('span', 'abj-panel-hint', format(value));
  const top = el('div', 'abj-panel-slider-top');
  top.append(el('span', undefined, label), valueLabel);

  const input = el('input');
  input.type = 'range';
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(value);
  input.addEventListener('input', () => {
    const next = Number(input.value);
    valueLabel.textContent = format(next);
    isDraggingSlider = true;
    updateCustomization(toUpdate(next));
    isDraggingSlider = false;
  });

  root.append(top, input);
  return root;
}

function swatches(
  colors: string[], selected: string | undefined, defaultLabel: string, onSelect: (color?: string) => void,
) {
  const root = el('div', 'abj-panel-swatches');
  const reset = el('button', 'abj-panel-swatch abj-panel-swatch-default', '✕');
  reset.title = defaultLabel;
  reset.classList.toggle('abj-panel-swatch-selected', !selected);
  reset.addEventListener('click', () => onSelect(undefined));
  root.append(reset);

  colors.forEach((color) => {
    const swatch = el('button', 'abj-panel-swatch');
    swatch.style.background = color;
    swatch.classList.toggle('abj-panel-swatch-selected', color === selected);
    swatch.addEventListener('click', () => onSelect(color));
    root.append(swatch);
  });

  const isCustom = Boolean(selected && !colors.includes(selected));
  const custom = colorInput(isCustom ? selected! : colors[0], onSelect);
  custom.classList.add('abj-panel-swatch-custom');
  custom.classList.toggle('abj-panel-swatch-selected', isCustom);
  if (!isCustom) custom.style.removeProperty('background');
  root.append(custom);
  return root;
}

function colorInput(color: string, onChange: (color: string) => void) {
  const root = el('label', 'abj-panel-swatch');
  root.style.background = color;
  const input = el('input');
  input.type = 'color';
  input.value = color;
  // `change` fires once the picker closes, so the panel doesn't re-render under the open picker
  input.addEventListener('change', () => onChange(input.value.toUpperCase()));
  root.append(input);
  return root;
}

function roundButton(text: string, title: string, onClick: () => void) {
  const button = el('button', 'abj-panel-swatch abj-panel-round', text);
  button.title = title;
  button.addEventListener('click', onClick);
  return button;
}

function textInput(placeholder: string, value: string, onCommit: (value: string) => void) {
  const input = el('input', 'abj-panel-input');
  input.placeholder = placeholder;
  input.value = value;
  input.addEventListener('change', () => onCommit(input.value));
  return input;
}

function action(label: string, onClick: () => void, isDestructive?: boolean) {
  const button = el('button', `abj-panel-action${isDestructive ? ' abj-panel-action-destructive' : ''}`, label);
  button.addEventListener('click', onClick);
  return button;
}

function pickFile(accept: string, onPick: (file: File) => void) {
  const input = el('input');
  input.type = 'file';
  input.accept = accept;
  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  });
  input.click();
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
