// Общая загрузка круглой иконки. Ключ и путь задаёт наследник.
// Строка пути буквальная: singlefile-сборка подменяет её на data:.

import Phaser from 'phaser';

export class AbilityIconBase {
    protected static iconKey = '';
    // Путь буквальный: singlefile-сборка подменяет его на data:.
    protected static iconPath = '';

    // Радиус круга. Такой же, как у иконок способностей над лентой.
    static iconRadius = 30;

    static preload(scene: Phaser.Scene): void {
        if (scene.textures.exists(this.iconKey)) {
            return;
        }

        scene.load.image(this.iconKey, this.iconPath);
    }
}
