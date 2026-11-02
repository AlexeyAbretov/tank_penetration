// Phaser пишет громкость через gain.setValueAtTime(value, 0), а читает gain.value.
// Автоматизация value не меняет: у нового узла там остаётся 1.
// Твин музыки читает эту единицу и затихает к числу с ползунка.
// На F5 при нуле сначала слышны музыка и эффекты, потом они гаснут.
// Здесь каждый GainNode сам записывает value. Отдельные звуки про это не знают.
// Ставить до new Phaser.Game: мастер-узлы рождаются в конструкторе звука.

const PATCHED = '__tankPenetrationGain';

const heard = new WeakMap<AudioParam, number>();
const tracked = new WeakMap<AudioContext, WeakRef<AudioParam>[]>();

type Patchable = {
  prototype: AudioContext;
  [PATCHED]?: boolean;
};

export function installClipVolumes(): void {
  patch(window.AudioContext as unknown as Patchable | undefined);
  const webkit = (window as Window & { webkitAudioContext?: Patchable }).webkitAudioContext;
  if (webkit && webkit !== (window.AudioContext as unknown as Patchable)) {
    patch(webkit);
  }
}

function patch(Ctor: Patchable | undefined): void {
  if (!Ctor || Ctor[PATCHED]) {
    return;
  }
  Ctor[PATCHED] = true;
  const createGain = Ctor.prototype.createGain;
  Ctor.prototype.createGain = function (this: AudioContext): GainNode {
    const node = createGain.call(this);
    keepValue(this, node.gain);
    return node;
  };
}

function keepValue(context: AudioContext, param: AudioParam): void {
  remember(context, param);
  const setValueAtTime = param.setValueAtTime;
  param.setValueAtTime = function (this: AudioParam, value: number, startTime: number): AudioParam {
    const scheduled = setValueAtTime.call(this, value, startTime);
    // value отменяет автоматизацию и оставляет чтению то же число, что слышно.
    this.value = value;
    heard.set(this, value);
    return scheduled;
  };
}

// Пока контекст suspended, запись могла не доехать. На running пишем её снова.
function remember(context: AudioContext, param: AudioParam): void {
  let list = tracked.get(context);
  if (!list) {
    list = [];
    tracked.set(context, list);
    context.addEventListener('statechange', () => {
      if (context.state !== 'running') {
        return;
      }
      const live: WeakRef<AudioParam>[] = [];
      for (const ref of list!) {
        const node = ref.deref();
        if (!node) {
          continue;
        }
        live.push(ref);
        const level = heard.get(node);
        if (level !== undefined) {
          node.value = level;
        }
      }
      list!.length = 0;
      list!.push(...live);
    });
  }
  list.push(new WeakRef(param));
}
