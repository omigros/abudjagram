import { memo } from '../../../lib/teact/teact';

import buildClassName from '../../../util/buildClassName';

import useLastCallback from '../../../hooks/useLastCallback';

import Icon from '../../common/icons/Icon';

import styles from './ColorSwatches.module.scss';

type OwnProps = {
  colors: string[];
  selected?: string;
  defaultLabel?: string;
  onSelect: (color?: string) => void;
};

const ColorSwatches = ({
  colors,
  selected,
  defaultLabel,
  onSelect,
}: OwnProps) => {
  const isCustomSelected = Boolean(selected && !colors.includes(selected));

  const handleCustomChange = useLastCallback((e: React.FormEvent<HTMLInputElement>) => {
    onSelect(e.currentTarget.value.toUpperCase());
  });

  return (
    <div className={styles.root}>
      {defaultLabel && (
        <button
          type="button"
          className={buildClassName(styles.swatch, styles.defaultSwatch, !selected && styles.selected)}
          title={defaultLabel}
          aria-label={defaultLabel}
          onClick={() => onSelect(undefined)}
        >
          <Icon name="close" />
        </button>
      )}
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          className={buildClassName(styles.swatch, selected === color && styles.selected)}
          style={`--swatch-color: ${color}`}
          aria-label={color}
          onClick={() => onSelect(color)}
        />
      ))}
      <label
        className={buildClassName(styles.swatch, styles.customSwatch, isCustomSelected && styles.selected)}
        style={isCustomSelected ? `--swatch-color: ${selected}` : undefined}
      >
        <input
          type="color"
          className={styles.picker}
          value={selected || colors[0]}
          onInput={handleCustomChange}
        />
        {!isCustomSelected && <Icon name="add" />}
      </label>
    </div>
  );
};

export default memo(ColorSwatches);
