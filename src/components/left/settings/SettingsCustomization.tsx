import type { ChangeEvent } from 'react';
import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type { TrayIcon } from '../../../customization/electronBridge';
import type { ThemePreset } from '../../../customization/presets';
import type {
  AnimationEasing, AuroraPalette, BackdropKind, CustomizationSettings, FontPreset, GradientKind, MessageAppearance,
} from '../../../customization/settings';

import buildClassName from '../../../util/buildClassName';
import download from '../../../util/download';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import { clearApiCredentials, getIsApiCredentialsBuiltIn } from '../../../customization/apiCredentials';
import {
  getCanUseBackgroundMaterial, removeBackdropVideo, saveBackdropVideo,
} from '../../../customization/applyCustomization';
import { ELECTRON_BRIDGE, IS_TRANSPARENT_WINDOW } from '../../../customization/electronBridge';
import { ACCENT_PRESETS, MAX_GRADIENT_COLORS, MIN_GRADIENT_COLORS } from '../../../customization/palette';
import { applyThemePreset, THEME_PRESETS } from '../../../customization/presets';
import {
  exportCustomization,
  getCustomization,
  importCustomization,
  resetCustomization,
  subscribeToCustomization,
  updateCustomization,
} from '../../../customization/settings';

import useHistoryBack from '../../../hooks/useHistoryBack';
import useLang from '../../../hooks/useLang';
import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';
import Island, { IslandTitle } from '../../gili/layout/Island';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';
import TextArea from '../../ui/TextArea';
import ColorSwatches from './ColorSwatches';

import styles from './SettingsCustomization.module.scss';

type OwnProps = {
  isActive?: boolean;
  onReset: () => void;
};

const EXPORT_FILENAME = 'abudjagram-theme.json';
const SETTINGS_ACCEPT = 'application/json,.json';
const VIDEO_ACCEPT = 'video/mp4,video/webm';
const SPEED_PERCENT = 100;
const MIN_BLUR = 0;
const MAX_BLUR = 60;
const MIN_OPACITY = 10;
const MAX_OPACITY = 95;
const MIN_SATURATION = 100;
const MAX_SATURATION = 220;
const SATURATION_STEP = 10;
const MAX_DIM = 80;
const MIN_SPEED = 50;
const MAX_SPEED = 200;
const SPEED_STEP = 10;
const MAX_BUBBLE_RADIUS = 24;
const MIN_UI_SCALE = 80;
const MAX_UI_SCALE = 130;
const UI_SCALE_STEP = 5;
const MAX_GRAIN = 100;
const MAX_ANGLE = 360;
const ANGLE_STEP = 15;
const MAX_TRANSPARENT_TINT = 95;
const GLASS_TINT_PRESETS = ['#FFFFFF', '#17171C', '#1E1B2E', '#0F2A2E', '#2E1A24', '#F3E9FF'];
const NEW_GRADIENT_COLOR = '#FFD166';
// Transparency needs a frameless window with the custom title bar, which macOS doesn't get
const CAN_USE_TRANSPARENT_WINDOW = Boolean(ELECTRON_BRIDGE?.titleBarHeight);

const SettingsCustomization = ({
  isActive,
  onReset,
}: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const [settings, setSettings] = useState<CustomizationSettings>(getCustomization);
  const [cssDraft, setCssDraft] = useState(settings.customCss);
  const [videoUrlDraft, setVideoUrlDraft] = useState(settings.videoUrl || '');
  const [fontDraft, setFontDraft] = useState(settings.customFontFamily || '');
  const [isAutoLaunchEnabled, setIsAutoLaunchEnabled] = useState<boolean>();
  const [isTransparentWindowWanted, setIsTransparentWindowWanted] = useState(IS_TRANSPARENT_WINDOW);
  const [trayIcons, setTrayIcons] = useState<TrayIcon[]>();

  useEffect(() => subscribeToCustomization(setSettings), []);

  useEffect(() => {
    void ELECTRON_BRIDGE?.getAutoLaunch().then(setIsAutoLaunchEnabled);
    void ELECTRON_BRIDGE?.getTrayIcons().then(setTrayIcons);
  }, []);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const canUseBackgroundMaterial = getCanUseBackgroundMaterial();

  const backdropOptions = useMemo(() => {
    const options = [
      { value: 'telegram', label: lang('AbjBackdropTelegram') },
      { value: 'aurora', label: lang('AbjBackdropAurora'), subLabel: lang('AbjBackdropAuroraInfo') },
      { value: 'gradient', label: lang('AbjBackdropGradient'), subLabel: lang('AbjBackdropGradientInfo') },
      { value: 'video', label: lang('AbjBackdropVideo') },
    ];
    if (IS_TRANSPARENT_WINDOW) {
      options.push({
        value: 'transparent', label: lang('AbjBackdropTransparent'), subLabel: lang('AbjBackdropTransparentInfo'),
      });
    }
    if (!canUseBackgroundMaterial) return options;

    return [
      ...options,
      { value: 'mica', label: lang('AbjBackdropMica'), subLabel: lang('AbjBackdropNativeInfo') },
      { value: 'acrylic', label: lang('AbjBackdropAcrylic'), subLabel: lang('AbjBackdropNativeInfo') },
    ];
  }, [lang, canUseBackgroundMaterial]);

  const paletteOptions = useMemo(() => [
    { value: 'aurora', label: lang('AbjPaletteAurora') },
    { value: 'sunset', label: lang('AbjPaletteSunset') },
    { value: 'ocean', label: lang('AbjPaletteOcean') },
    { value: 'neon', label: lang('AbjPaletteNeon') },
  ], [lang]);

  const gradientKindOptions = useMemo(() => [
    { value: 'mesh', label: lang('AbjGradientMesh') },
    { value: 'linear', label: lang('AbjGradientLinear') },
    { value: 'radial', label: lang('AbjGradientRadial') },
  ], [lang]);

  const easingOptions = useMemo(() => [
    { value: 'default', label: lang('AbjEasingDefault') },
    { value: 'smooth', label: lang('AbjEasingSmooth') },
    { value: 'bouncy', label: lang('AbjEasingBouncy') },
    { value: 'snappy', label: lang('AbjEasingSnappy') },
  ], [lang]);

  const appearanceOptions = useMemo(() => [
    { value: 'default', label: lang('AbjAppearanceDefault') },
    { value: 'fade', label: lang('AbjAppearanceFade') },
    { value: 'slide', label: lang('AbjAppearanceSlide') },
    { value: 'pop', label: lang('AbjAppearancePop') },
    { value: 'blur', label: lang('AbjAppearanceBlur') },
  ], [lang]);

  const fontOptions = useMemo(() => [
    { value: 'default', label: lang('AbjFontDefault') },
    { value: 'system', label: lang('AbjFontSystem') },
    { value: 'inter', label: 'Inter' },
    { value: 'manrope', label: 'Manrope' },
    { value: 'nunito', label: 'Nunito' },
    { value: 'jetbrains', label: 'JetBrains Mono' },
    { value: 'custom', label: lang('AbjFontCustom') },
  ], [lang]);

  const handleApplyPreset = useLastCallback((preset: ThemePreset) => {
    const next = applyThemePreset(settings, preset);
    updateCustomization(next);
    setFontDraft(next.customFontFamily || '');
  });

  const handleFontDraftChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFontDraft(e.target.value);
  });

  const handleFontCommit = useLastCallback(() => {
    updateCustomization({ customFontFamily: fontDraft.trim() || undefined });
  });

  const handleFontKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleFontCommit();
  });

  const handleAutoLaunchChange = useLastCallback((isChecked: boolean) => {
    ELECTRON_BRIDGE?.setAutoLaunch(isChecked);
    setIsAutoLaunchEnabled(isChecked);
  });

  const handleGradientColorChange = useLastCallback((index: number, color: string) => {
    const gradientColors = settings.gradientColors.slice();
    gradientColors[index] = color.toUpperCase();
    updateCustomization({ gradientColors });
  });

  const handleAddGradientColor = useLastCallback(() => {
    updateCustomization({ gradientColors: [...settings.gradientColors, NEW_GRADIENT_COLOR] });
  });

  const handleRemoveGradientColor = useLastCallback(() => {
    updateCustomization({ gradientColors: settings.gradientColors.slice(0, -1) });
  });

  const handleTransparentWindowChange = useLastCallback((isChecked: boolean) => {
    ELECTRON_BRIDGE?.setTransparentWindow(isChecked);
    setIsTransparentWindowWanted(isChecked);
    // The see-through backdrop is the point of the mode, so it is picked right away
    if (isChecked) updateCustomization({ backdrop: 'transparent' });
  });

  const handleTrayIconSelect = useLastCallback((id: string) => {
    ELECTRON_BRIDGE?.setTrayIcon(id);
    setTrayIcons(trayIcons?.map((icon) => ({ ...icon, isSelected: icon.id === id })));
  });

  const handleRelaunch = useLastCallback(() => {
    ELECTRON_BRIDGE?.relaunch();
  });

  const handleChangeApiKeys = useLastCallback(() => {
    clearApiCredentials();
    window.location.reload();
  });

  const handleChooseVideo = useLastCallback(() => {
    openSystemFilesDialog(VIDEO_ACCEPT, async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      await saveBackdropVideo(file);
      updateCustomization({ backdrop: 'video', hasVideoFile: true });
    }, true);
  });

  const handleRemoveVideo = useLastCallback(async () => {
    await removeBackdropVideo();
    updateCustomization({ hasVideoFile: undefined });
  });

  const handleVideoUrlChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setVideoUrlDraft(e.target.value);
  });

  const handleVideoUrlCommit = useLastCallback(() => {
    updateCustomization({ videoUrl: videoUrlDraft.trim() || undefined });
  });

  const handleVideoUrlKeyDown = useLastCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleVideoUrlCommit();
  });

  const handleCssChange = useLastCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    setCssDraft(e.target.value);
  });

  const handleApplyCss = useLastCallback(() => {
    updateCustomization({ customCss: cssDraft });
  });

  const handleExport = useLastCallback(() => {
    const file = new File([exportCustomization()], EXPORT_FILENAME, { type: 'application/json' });
    download(URL.createObjectURL(file), EXPORT_FILENAME);
  });

  const handleImport = useLastCallback(() => {
    openSystemFilesDialog(SETTINGS_ACCEPT, async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        importCustomization(await file.text());
        const imported = getCustomization();
        setCssDraft(imported.customCss);
        setVideoUrlDraft(imported.videoUrl || '');
      } catch (err) {
        showNotification({ message: { key: 'AbjImportError' } });
      }
    }, true);
  });

  const handleResetAll = useLastCallback(async () => {
    await removeBackdropVideo();
    resetCustomization();
    setCssDraft('');
    setVideoUrlDraft('');
    setFontDraft('');
  });

  const canChangeApiKeys = !getIsApiCredentialsBuiltIn();
  const isGlassDisabled = !settings.isGlassEnabled;
  const hasCustomBackdrop = settings.backdrop === 'aurora' || settings.backdrop === 'gradient'
    || settings.backdrop === 'video';

  return (
    <div className="settings-content custom-scroll">
      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjPresets')}</IslandTitle>
      <div className={styles.presets}>
        {THEME_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.preset}
            onClick={() => handleApplyPreset(preset)}
          >
            <span className={styles.presetPreview} style={`background: ${preset.preview}`} />
            <span className={styles.presetName}>{lang(preset.nameKey)}</span>
          </button>
        ))}
      </div>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjAccent')}</IslandTitle>
      <Island>
        <ColorSwatches
          colors={ACCENT_PRESETS}
          selected={settings.accentColor}
          defaultLabel={lang('AbjAccentDefault')}
          onSelect={(color) => updateCustomization({ accentColor: color })}
        />
        <Checkbox
          label={lang('AbjOwnBubbleTint')}
          checked={Boolean(settings.isOwnBubbleTinted)}
          disabled={!settings.accentColor}
          onCheck={(isChecked) => updateCustomization({ isOwnBubbleTinted: isChecked || undefined })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjGlass')}</IslandTitle>
      <Island>
        <Checkbox
          label={lang('AbjGlassEnabled')}
          subLabel={lang('AbjGlassEnabledInfo')}
          checked={settings.isGlassEnabled}
          onCheck={(isChecked) => updateCustomization({ isGlassEnabled: isChecked })}
        />
        <RangeSlider
          label={lang('AbjGlassBlur')}
          min={MIN_BLUR}
          max={MAX_BLUR}
          value={settings.glassBlur}
          disabled={isGlassDisabled}
          renderValue={(value) => `${value} px`}
          onChange={(value) => updateCustomization({ glassBlur: value })}
        />
        <RangeSlider
          label={lang('AbjGlassOpacity')}
          min={MIN_OPACITY}
          max={MAX_OPACITY}
          value={settings.glassOpacity}
          disabled={isGlassDisabled}
          renderValue={(value) => `${value}%`}
          onChange={(value) => updateCustomization({ glassOpacity: value })}
        />
        <RangeSlider
          label={lang('AbjGlassSaturation')}
          min={MIN_SATURATION}
          max={MAX_SATURATION}
          step={SATURATION_STEP}
          value={settings.glassSaturation}
          disabled={isGlassDisabled}
          renderValue={(value) => `${value}%`}
          onChange={(value) => updateCustomization({ glassSaturation: value })}
        />
        <Checkbox
          label={lang('AbjGlassHighlight')}
          checked={settings.hasGlassHighlight}
          disabled={isGlassDisabled}
          onCheck={(isChecked) => updateCustomization({ hasGlassHighlight: isChecked })}
        />
        <Checkbox
          label={lang('AbjGlassBubbles')}
          checked={Boolean(settings.isGlassBubbles)}
          disabled={isGlassDisabled}
          onCheck={(isChecked) => updateCustomization({ isGlassBubbles: isChecked || undefined })}
        />
        <div className={styles.subheader}>{lang('AbjGlassTint')}</div>
        <ColorSwatches
          colors={GLASS_TINT_PRESETS}
          selected={settings.glassTint}
          defaultLabel={lang('AbjAccentDefault')}
          onSelect={(color) => updateCustomization({ glassTint: color })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjBackdrop')}</IslandTitle>
      <Island>
        <RadioGroup
          name="abj-backdrop"
          options={backdropOptions}
          selected={settings.backdrop}
          onChange={(value) => updateCustomization({ backdrop: value as BackdropKind })}
        />
        {hasCustomBackdrop && (
          <RangeSlider
            label={lang('AbjBackdropDim')}
            min={0}
            max={MAX_DIM}
            value={settings.backdropDim}
            renderValue={(value) => `${value}%`}
            onChange={(value) => updateCustomization({ backdropDim: value })}
          />
        )}
        {hasCustomBackdrop && (
          <RangeSlider
            label={lang('AbjGrain')}
            min={0}
            max={MAX_GRAIN}
            value={settings.grain}
            renderValue={(value) => `${value}%`}
            onChange={(value) => updateCustomization({ grain: value })}
          />
        )}
        {settings.backdrop === 'transparent' && (
          <RangeSlider
            label={lang('AbjTransparentTint')}
            min={0}
            max={MAX_TRANSPARENT_TINT}
            value={settings.transparentTint}
            renderValue={(value) => `${value}%`}
            onChange={(value) => updateCustomization({ transparentTint: value })}
          />
        )}
      </Island>

      {settings.backdrop === 'gradient' && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjGradient')}</IslandTitle>
          <Island>
            <div className={styles.gradientColors}>
              <div
                className={styles.gradientPreview}
                style={`background: linear-gradient(90deg, ${settings.gradientColors.join(', ')})`}
              />
              {settings.gradientColors.map((color, index) => (
                <label key={index} className={styles.gradientColor} style={`--swatch-color: ${color}`}>
                  <input
                    type="color"
                    className={styles.gradientPicker}
                    value={color}
                    onInput={(e) => handleGradientColorChange(index, (e.target as HTMLInputElement).value)}
                  />
                </label>
              ))}
              {settings.gradientColors.length < MAX_GRADIENT_COLORS && (
                <button
                  type="button"
                  className={styles.gradientButton}
                  aria-label={lang('AbjGradientAddColor')}
                  title={lang('AbjGradientAddColor')}
                  onClick={handleAddGradientColor}
                >
                  <Icon name="add" />
                </button>
              )}
              {settings.gradientColors.length > MIN_GRADIENT_COLORS && (
                <button
                  type="button"
                  className={styles.gradientButton}
                  aria-label={lang('AbjGradientRemoveColor')}
                  title={lang('AbjGradientRemoveColor')}
                  onClick={handleRemoveGradientColor}
                >
                  <Icon name="remove" />
                </button>
              )}
            </div>
            <RadioGroup
              name="abj-gradient-kind"
              options={gradientKindOptions}
              selected={settings.gradientKind}
              onChange={(value) => updateCustomization({ gradientKind: value as GradientKind })}
            />
            {settings.gradientKind === 'linear' && (
              <RangeSlider
                label={lang('AbjGradientAngle')}
                min={0}
                max={MAX_ANGLE}
                step={ANGLE_STEP}
                value={settings.gradientAngle}
                renderValue={(value) => `${value}°`}
                onChange={(value) => updateCustomization({ gradientAngle: value })}
              />
            )}
            {settings.gradientKind === 'mesh' && (
              <Checkbox
                label={lang('AbjGradientAnimated')}
                checked={settings.isGradientAnimated}
                onCheck={(isChecked) => updateCustomization({ isGradientAnimated: isChecked })}
              />
            )}
          </Island>
        </>
      )}

      {settings.backdrop === 'aurora' && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjPalette')}</IslandTitle>
          <Island>
            <RadioGroup
              name="abj-palette"
              options={paletteOptions}
              selected={settings.auroraPalette}
              onChange={(value) => updateCustomization({ auroraPalette: value as AuroraPalette })}
            />
          </Island>
        </>
      )}

      {settings.backdrop === 'video' && (
        <Island>
          <ListItem icon="video" onClick={handleChooseVideo}>
            {lang('AbjVideoChooseFile')}
          </ListItem>
          {settings.hasVideoFile && (
            <ListItem icon="delete" destructive onClick={handleRemoveVideo}>
              {lang('AbjVideoRemoveFile')}
            </ListItem>
          )}
          {!settings.hasVideoFile && (
            <div className={styles.field}>
              <InputText
                label={lang('AbjVideoUrl')}
                value={videoUrlDraft}
                onChange={handleVideoUrlChange}
                onBlur={handleVideoUrlCommit}
                onKeyDown={handleVideoUrlKeyDown}
              />
            </div>
          )}
        </Island>
      )}

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjMessages')}</IslandTitle>
      <Island>
        <RangeSlider
          label={lang('AbjBubbleRadius')}
          min={0}
          max={MAX_BUBBLE_RADIUS}
          value={settings.bubbleRadius}
          renderValue={(value) => `${value} px`}
          onChange={(value) => updateCustomization({ bubbleRadius: value })}
        />
        <Checkbox
          label={lang('AbjBubbleTails')}
          checked={settings.hasBubbleTails}
          onCheck={(isChecked) => updateCustomization({ hasBubbleTails: isChecked })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjFont')}</IslandTitle>
      <Island>
        <RadioGroup
          name="abj-font"
          options={fontOptions}
          selected={settings.fontPreset}
          onChange={(value) => updateCustomization({ fontPreset: value as FontPreset })}
        />
        {settings.fontPreset === 'custom' && (
          <div className={styles.field}>
            <InputText
              label={lang('AbjFontCustomName')}
              value={fontDraft}
              placeholder="Comic Sans MS"
              onChange={handleFontDraftChange}
              onBlur={handleFontCommit}
              onKeyDown={handleFontKeyDown}
            />
          </div>
        )}
        <RangeSlider
          label={lang('AbjUiScale')}
          min={MIN_UI_SCALE}
          max={MAX_UI_SCALE}
          step={UI_SCALE_STEP}
          value={settings.uiScale}
          renderValue={(value) => `${value}%`}
          onChange={(value) => updateCustomization({ uiScale: value })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjAnimations')}</IslandTitle>
      <Island>
        <RangeSlider
          label={lang('AbjAnimationSpeed')}
          min={MIN_SPEED}
          max={MAX_SPEED}
          step={SPEED_STEP}
          value={Math.round(settings.animationSpeed * SPEED_PERCENT)}
          renderValue={(value) => `${(value / SPEED_PERCENT).toFixed(1)}×`}
          onChange={(value) => updateCustomization({ animationSpeed: value / SPEED_PERCENT })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjEasing')}</IslandTitle>
      <Island>
        <RadioGroup
          name="abj-easing"
          options={easingOptions}
          selected={settings.animationEasing}
          onChange={(value) => updateCustomization({ animationEasing: value as AnimationEasing })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjAppearance')}</IslandTitle>
      <Island>
        <RadioGroup
          name="abj-appearance"
          options={appearanceOptions}
          selected={settings.messageAppearance}
          onChange={(value) => updateCustomization({ messageAppearance: value as MessageAppearance })}
        />
      </Island>

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjCustomCss')}</IslandTitle>
      <Island>
        <div className={styles.field}>
          <TextArea
            className={styles.cssEditor}
            value={cssDraft}
            placeholder={'.Message .message-content {\n  border-radius: 0.5rem;\n}'}
            noReplaceNewlines
            onChange={handleCssChange}
          />
          <p className="settings-item-description">{lang('AbjCustomCssInfo')}</p>
          <Button
            size="smaller"
            disabled={cssDraft === settings.customCss}
            onClick={handleApplyCss}
          >
            {lang('AbjCustomCssApply')}
          </Button>
        </div>
      </Island>

      {(ELECTRON_BRIDGE || canChangeApiKeys) && (
        <>
          <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjApp')}</IslandTitle>
          <Island>
            {ELECTRON_BRIDGE && (
              <Checkbox
                label={lang('AbjAutoLaunch')}
                subLabel={lang('AbjAutoLaunchInfo')}
                checked={Boolean(isAutoLaunchEnabled)}
                disabled={isAutoLaunchEnabled === undefined}
                onCheck={handleAutoLaunchChange}
              />
            )}
            {Boolean(trayIcons?.length) && (
              <>
                <div className={styles.subheader}>{lang('AbjTrayIcon')}</div>
                <div className={styles.trayIcons}>
                  {trayIcons.map((icon) => (
                    <button
                      key={icon.id}
                      type="button"
                      title={icon.name}
                      className={buildClassName(styles.trayIcon, icon.isSelected && styles.trayIconSelected)}
                      onClick={() => handleTrayIconSelect(icon.id)}
                    >
                      <img src={icon.dataUrl} alt={icon.name} />
                    </button>
                  ))}
                </div>
              </>
            )}
            {CAN_USE_TRANSPARENT_WINDOW && (
              <Checkbox
                label={lang('AbjTransparentWindow')}
                subLabel={lang('AbjTransparentWindowInfo')}
                checked={isTransparentWindowWanted}
                onCheck={handleTransparentWindowChange}
              />
            )}
            {isTransparentWindowWanted !== IS_TRANSPARENT_WINDOW && (
              <ListItem icon="reload" onClick={handleRelaunch}>
                {lang('AbjRelaunch')}
              </ListItem>
            )}
            {canChangeApiKeys && (
              <ListItem icon="key" multiline onClick={handleChangeApiKeys}>
                <span className="title">{lang('AbjApiKeys')}</span>
                <span className="subtitle">{lang('AbjApiKeysInfo')}</span>
              </ListItem>
            )}
          </Island>
        </>
      )}

      <IslandTitle dir={lang.isRtl ? 'rtl' : undefined}>{lang('AbjBackup')}</IslandTitle>
      <Island>
        <ListItem icon="download" onClick={handleExport}>
          {lang('AbjExport')}
        </ListItem>
        <ListItem icon="document" onClick={handleImport}>
          {lang('AbjImport')}
        </ListItem>
        <ListItem icon="reload" destructive onClick={handleResetAll}>
          {lang('AbjReset')}
        </ListItem>
      </Island>
    </div>
  );
};

export default memo(SettingsCustomization);
