export const preloadImages = (scene: Phaser.Scene) => {
  scene.load.image('tank-hull', 'assets/tank-hull.png');
  scene.load.image('tank-turret', 'assets/tank-turret.png');
  scene.load.image('tank-gun', 'assets/tank-gun.png');
  scene.load.image('tank-mg', 'assets/tank-mg.png');
};
