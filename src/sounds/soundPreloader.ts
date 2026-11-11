export const preloadSounds = (scene: Phaser.Scene) => {
      // TRACK_01 — обычные волны. boss — каждая 10-я.
    // tank_shot — хлопок пушки. tank_mg_shot — пулемёт на башне. laserSmall_000 — луч лазера.
    // gunner_shot — пуля врага.
    // bullet_hit_tank — удар этой пули о броню.
    // tank_dead — гибель базы.
    // assault_explosion — штурмовик дошёл до брони.
    // infantry_dead0..1 — крик пехоты, убитой танком. impact0..2 — удар снаряда по врагу.
    // pickup_exposion — гибель пикапа, багги и вертолёта.
    // rocket_shot — пуск ракеты. rocket_hit_tank — её взрыв о броню.
    // rocket_burst — разрыв в воздухе, когда лазер её сбивает. Из середины записи, тишина срезана.
    // artillery_shot — хлопок батареи. artillery_explosion — разрыв снаряда и мины.
    // nuclear_explosion — взрыв атомной бомбы. Тишина в начале и пустой хвост срезаны.
    // ion_appear — низкий сход ионного столба. lowFrequency_explosion_000 — удар подошвы.
    // thrusterFire_000 — шипение, пока столб идёт.
    // heavy-tank-boss-engine — гул мотора тяжёлого танка, пока корпус жив.
    // heavy-tank-boss-tracks — лязг гусениц, только пока танк едет.
    scene.load.audio('music-wave', 'audio/TRACK_01.mp3');
    scene.load.audio('music-boss', 'audio/boss.mp3');
    scene.load.audio('tank-shot', 'audio/tank_shot.mp3');
    scene.load.audio('tank-mg-shot', 'audio/tank_mg_shot.mp3');
    scene.load.audio('laser-shot', 'audio/laserSmall_000.ogg');
    scene.load.audio('gunner-shot', 'audio/gunner_shot.mp3');
    scene.load.audio('bullet-hit-tank', 'audio/bullet_hit_tank.mp3');
    scene.load.audio('tank-dead', 'audio/tank_dead.mp3');
    scene.load.audio('assault-explosion', 'audio/assault_explosion.mp3');
    scene.load.audio('vehicle-explosion', 'audio/pickup_exposion.mp3');
    scene.load.audio('infantry-dead-0', 'audio/infantry_dead0.mp3');
    scene.load.audio('infantry-dead-1', 'audio/infantry_dead1.mp3');
    scene.load.audio('impact-0', 'audio/impact0.mp3');
    scene.load.audio('impact-1', 'audio/impact1.mp3');
    scene.load.audio('impact-2', 'audio/impact2.mp3');
    scene.load.audio('rocket-shot', 'audio/rocket_shot.mp3');
    scene.load.audio('rocket-hit-tank', 'audio/rocket_hit_tank.mp3');
    scene.load.audio('rocket-burst', 'audio/rocket_burst.mp3');
    scene.load.audio('artillery-shot', 'audio/artillery_shot.mp3');
    scene.load.audio('boom', 'audio/artillery_explosion.mp3');
    scene.load.audio('nuclear-explosion', 'audio/nuclear_explosion.mp3');
    scene.load.audio('ion-appear', 'audio/ion_appear.ogg');
    scene.load.audio('ion-impact', 'audio/lowFrequency_explosion_000.ogg');
    scene.load.audio('ion-sweep', 'audio/thrusterFire_000.ogg');
    scene.load.audio('heavy-tank-engine', 'audio/heavy-tank-boss-engine.mp3');
    scene.load.audio('heavy-tank-tracks', 'audio/heavy-tank-boss-tracks.mp3');
};