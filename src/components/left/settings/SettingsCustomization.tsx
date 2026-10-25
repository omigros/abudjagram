import type { ChangeEvent } from 'react';
import {
  memo, useEffect, useMemo, useState,
} from '../../../lib/teact/teact';
import { getActions } from '../../../global';

import type {
  AnimationEasing, AuroraPalette, BackdropKind, CustomizationSettings, MessageAppearance,
} from '../../../customization/settings';

import download from '../../../util/download';
import { openSystemFilesDialog } from '../../../util/systemFilesDialog';
import {
  getCanUseBackgroundMaterial, removeBackdropVideo, saveBackdropVideo,
} from '../../../customization/applyCustomization';
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

import Island, { IslandTitle } from '../../gili/layout/Island';
import Button from '../../ui/Button';
import Checkbox from '../../ui/Checkbox';
import InputText from '../../ui/InputText';
import ListItem from '../../ui/ListItem';
import RadioGroup from '../../ui/RadioGroup';
import RangeSlider from '../../ui/RangeSlider';
import TextArea from '../../ui/TextArea';

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

const SettingsCustomization = ({
  isActive,
  onReset,
}: OwnProps) => {
  const { showNotification } = getActions();

  const lang = useLang();

  const [settings, setSettings] = useState<CustomizationSettings>(getCustomization);
  const [cssDraft, setCssDraft] = useState(settings.customCss);
  const [videoUrlDraft, setVideoUrlDraft] = useState(settings.videoUrl || '');

  useEffect(() => subscribeToCustomization(setSettings), []);

  useHistoryBack({
    isActive,
    onBack: onReset,
  });

  const canUseBackgroundMaterial = getCanUseBackgroundMaterial();

  const backdropOptions = useMemo(() => {
    const options = [
      { value: 'telegram', label: lang('AbjBackdropTelegram') },
      { value: 'aurora', label: lang('AbjBackdropAurora'), subLabel: lang('AbjBackdropAuroraInfo') },
      { value: 'video', label: lang('AbjBackdropVideo') },
    ];
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
  });

  const isGlassDisabled = !settings.isGlassEnabled;
  const hasCustomBackdrop = settings.backdrop === 'aurora' || settings.backdrop === 'video';

  return (
    <div className="settings-content custom-scroll">
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
      </Island>

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
