import type { ChangeEvent, FormEvent } from 'react';
import { memo, useState } from '../lib/teact/teact';

import {
  getIsApiCredentialsRejected, saveApiCredentials, validateApiHash, validateApiId,
} from './apiCredentials';
import { ELECTRON_BRIDGE } from './electronBridge';

import useLastCallback from '../hooks/useLastCallback';

import Button from '../components/ui/Button';
import InputText from '../components/ui/InputText';

import styles from './ApiSetupScreen.module.scss';

const MY_TELEGRAM_URL = 'https://my.telegram.org/apps';

// Rendered before the app and its localization start, so the texts live here instead of language packs
const TEXT = {
  title: 'Ключи Telegram API',
  description: 'Abudjagram подключается к Telegram через ваше собственное приложение. '
    + 'Ключи нужны один раз и хранятся только на этом компьютере.',
  stepOpen: 'Откройте',
  stepCreate: 'Войдите по номеру телефона и создайте приложение в разделе API development tools '
    + '(платформа Desktop, название без слова «Telegram»).',
  stepCopy: 'Скопируйте сюда App api_id и App api_hash.',
  apiId: 'App api_id',
  apiHash: 'App api_hash',
  apiIdError: 'api_id — это число из 3–12 цифр',
  apiHashError: 'api_hash — это 32 символа: цифры и латинские буквы a–f',
  save: 'Сохранить и продолжить',
  rejected: 'Telegram не принял прошлые ключи. Проверьте api_id и api_hash на my.telegram.org.',
  webMode: 'Войти без ключей через официальный Telegram Web',
};

const ApiSetupScreen = () => {
  const isRejected = getIsApiCredentialsRejected();
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const isApiIdValid = validateApiId(apiId);
  const isApiHashValid = validateApiHash(apiHash);

  const handleApiIdChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setApiId(e.target.value);
  });

  const handleApiHashChange = useLastCallback((e: ChangeEvent<HTMLInputElement>) => {
    setApiHash(e.target.value);
  });

  const handleSubmit = useLastCallback((e: FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);
    if (!isApiIdValid || !isApiHashValid) return;

    saveApiCredentials(apiId, apiHash);
    window.location.reload();
  });

  const handleSwitchToWebMode = useLastCallback(() => {
    ELECTRON_BRIDGE!.setAppMode('web');
    ELECTRON_BRIDGE!.relaunch();
  });

  return (
    <div className={styles.root}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <h1 className={styles.title}>{TEXT.title}</h1>
        <p className={styles.description}>{TEXT.description}</p>
        {isRejected && <p className={styles.error}>{TEXT.rejected}</p>}
        <ol className={styles.steps}>
          <li>
            {TEXT.stepOpen}
            {' '}
            <a href={MY_TELEGRAM_URL} target="_blank" rel="noopener noreferrer">my.telegram.org</a>
          </li>
          <li>{TEXT.stepCreate}</li>
          <li>{TEXT.stepCopy}</li>
        </ol>
        <InputText
          label={TEXT.apiId}
          value={apiId}
          inputMode="numeric"
          error={isSubmitted && !isApiIdValid ? TEXT.apiIdError : undefined}
          onChange={handleApiIdChange}
        />
        <InputText
          label={TEXT.apiHash}
          value={apiHash}
          error={isSubmitted && !isApiHashValid ? TEXT.apiHashError : undefined}
          onChange={handleApiHashChange}
        />
        <Button type="submit" className={styles.submit}>{TEXT.save}</Button>
        {ELECTRON_BRIDGE && (
          <Button isText className={styles.submit} onClick={handleSwitchToWebMode}>{TEXT.webMode}</Button>
        )}
      </form>
    </div>
  );
};

export default memo(ApiSetupScreen);
