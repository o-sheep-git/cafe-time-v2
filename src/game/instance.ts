import { GameStore, browserStorage } from './store';

/** アプリ全体でひとつだけのストア（開発中のホットリロードでも作り直されないよう、単独のモジュールにしている） */
export const storage = browserStorage();
export const store = new GameStore(storage, Date.now());
