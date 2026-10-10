/**
 * 音源の差し替え表。
 * 既定ではどの音もブラウザ内で合成している（音源ファイルなしで動く）。
 * ファイルに差し替えるときは public/audio/ に置き、ここにパスを書く。
 *
 * 例:
 *   bgm: ['/audio/bgm-1.mp3', '/audio/bgm-2.mp3'],   // 順番にループ再生
 *   cafe: '/audio/cafe-ambience.mp3',                // ループ再生
 *   rain: '/audio/rain.mp3',                         // ループ再生
 */
export interface AudioSources {
  bgm: string[];
  cafe: string | null;
  rain: string | null;
}

export const AUDIO_SOURCES: AudioSources = {
  bgm: [],
  cafe: null,
  rain: null,
};
