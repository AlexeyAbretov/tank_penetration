// Иконка автонаведения. Покупка и выключатель живут в прогрессе, точку башне отдаёт бой.
// Картинка — assets/auto-aim-icon.png. Если файл не загрузился, кнопка рисуется кругом.

import Phaser from 'phaser';

export class AbilityIconBase {
    protected static iconKey = '';
    // Путь буквальный: singlefile-сборка подменяет его на data:.
    protected static iconPath = '';

    // Радиус круга. Такой же, как у иконок способностей над лентой.
    protected static iconRadius = 30;

    static preload(scene: Phaser.Scene): void {
        if (scene.textures.exists(this.iconKey)) {
            return;
        }

        scene.load.image(this.iconKey, this.iconPath);
    }
}
