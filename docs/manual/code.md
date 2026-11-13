# Как устроен код

[Оглавление](../../README.md)

Законы проекта — в `docs/constitution.md`. Кто за что отвечает — в `docs/architecture.md`. Исходники ниже читают по порядку. В начале файла есть комментарий, зачем он нужен. Дальше комментарии идут по строкам: что делает вызов Phaser и какое правило игры за ним стоит.

1. `index.html` показывает полосу загрузки до первого кадра. `src/main.ts` запускает Phaser, `src/bootScreen.ts` пишет процент очереди и снимает полосу, когда сцена создана. Размер холста, подгонка под окно и темп врагов лежат в `src/gameConfig.ts`. Шрифт подключает `src/ui/gameFont.ts` из `public/fonts`, до старта игры.
2. `src/scenes/GameScene.ts` собирает партию. `create()` создаёт системы один раз. `update()` каждый кадр вызывает их по очереди, а ещё держит паузу и запись сохранения. Дебаг-партия — наследники тех же классов, их включает `src/scenes/GameSceneFactory.ts`.
3. `src/systems/` — правила боя. Сцена их вызывает, сама почти ничего не рисует.
   - `CombatSystem` — снаряды танка, пулемёт, лазер, огнемёт, РСЗО, взрывы, проволока, артиллерия, бомбардировщик, ионная пушка, мины, атомный взрыв, энергетическая стена и ЭМИ.
   - `ProjectileSystem` — пули и ракеты, которые летят в танк. Поглощение отводит патрон без урона. Стоящая стена гасит выстрел на своём крае.
   - `WaveManager` — надпись волны, выход врагов и магазин после зачистки.
4. `src/controllers/` — игрок, пауза и оба магазина.
   - `PlayerController` — танк и здоровье базы. Запас новой партии начинает со 100, его держит `src/entities/Tank/TankBaseHp.ts`. Магазин очков поднимает запас шагами по 10 до 500.
   - `ShopController` — магазин между волнами. Окно только рисует карточки.
   - `ProgressShopController` — магазин после поражения.
   - `PauseStack` и `ScreenPause` — пауза по `Esc`, кнопке и уходу на другую вкладку. Уход ставит паузу, только если в настройках включён переключатель. Флаг держит `FocusPause`.
5. `src/sounds/` — музыка и эффекты. Громкость эффектов общая, `EffectsVolume`, и пишется в `localStorage` отдельно от музыки. На паузе и после гибели базы клипы останавливаются. Взрыв базы доигрывает уже на экране очков.
   - `BattleMusic` — луп обычной волны (`public/audio/TRACK_01.mp3`) и луп босса (`public/audio/boss.mp3`).
   - `TankShot`, `TankMgShot`, `LaserShot` — пушка, пулемёт башни и луч. Энергетическая стена в момент включения берёт тот же клип, что лазер.
   - `Descent` — низкий сход сверху (`public/audio/ion_appear.ogg`). Его берут пуск ионного столба и появление вспышки ЭМИ.
   - `EmpSpread` — расширение полусферы ЭМИ (`public/audio/forceField_000.ogg`). Играет, когда купол всходит у земли.
   - `IonCannonSounds` — удар подошвы ионного столба в землю и шипение, пока столб идёт. Шипение обрывается, когда ход кончается.
   - `GunnerShot` и `BulletHitTank` — хлопок вражеской пули и удар о броню. Стрелок, пикап, вертолёт, суперсолдат и БТР. Ракета эти звуки не берёт. Багги и ракетный залп вертолёта тоже: у них пуск ракеты. Тяжёлый танк берёт хлопок артиллерии.
   - `HeavyTankSounds` — гул мотора тяжёлого танка, пока корпус жив (`public/audio/heavy-tank-boss-engine.mp3`), и лязг гусениц, только пока он едет (`public/audio/heavy-tank-boss-tracks.mp3`). На рубеже и под ЭМИ гусеницы молчат.
   - `DroneCarrierSounds` — шум винтов дрономатки, пока корпус жив и винты крутятся (`public/audio/drone-carrier-boss.wav`). Две матки делят один клип. Под ЭМИ и после гибели его нет.
   - `BtrSounds` — гул мотора БТР, пока корпус жив (`public/audio/btr-engine.mp3`). На рубеже пулемёта и под ЭМИ он не смолкает. После гибели его нет.
   - `RocketSounds` — пуск ракеты и взрыв о броню. `RocketBurst` — разрыв ракеты, сбитой лазером.
   - `BoomSounds` — хлопок артиллерии и общий разрыв `public/audio/artillery_explosion.mp3`: артиллерия, мины, бомбардировщик, попадание снаряда тяжёлого танка и взрыв ударного дрона.
   - `NuclearExplosion`, `AssaultExplosion`, `VehicleExplosion`, `TankDeath` — атомный взрыв, штурмовик о броню, гибель пикапа, багги, вертолёта, тяжёлого танка, дрономатки и БТР, гибель базы.
   - `ImpactSounds` — удар снаряда и пули пулемёта по врагу, один из трёх файлов `impact0.mp3`, `impact1.mp3`, `impact2.mp3`.
   - `InfantryDeath` — крик пехоты, убитой танком, один из двух файлов. Пикап, багги, вертолёт, тяжёлый танк, дрономатка, БТР и штурмовик, дошедший до базы, этот звук не берут.
   - Общий список и пауза — `BattleEffects`.
6. `src/entities/` — то, что стоит на поле.
   - `Tank/Tank.ts` — корпус, башня и ствол.
   - `Infantry` — общий предок врагов: шаг, здоровье, полоска HP. Сам на поле не появляется.
   - `AssaultInfantry`, `GunnerInfantry`, `RocketInfantry`, `PickupTruck`, `RocketBuggy`, `Helicopter`, `SuperSoldier`, `HeavyTank`, `DroneCarrier`, `Btr` — виды врагов. `BuggyRocket` — самонаводящаяся ракета багги и вертолёта. `StrikeDrone` — ударный дрон дрономатки.
   - `RangedEnemy` — общая стрельба для тех, кто доходит до рубежа и встаёт. Суперсолдат, вертолёт и дрономатка этот класс не наследуют: у каждого свой цикл. БТР наследует его и ведёт свой маршрут.
   - `EnemyFactory` — кто именно выйдет в этой волне и с каким здоровьем.
   - `EnemyShot` и `Rocket` — вражеские снаряды.
   - `BarbedWire`, `MachineGun`, `LaserDefense`, `FlameTank`, `RocketSalvo`, `BomberStrike`, `IonCannon`, `Mines`, `NuclearStrike`, `EnergyWall` — покупки на поле. Иконки способностей лежат в `public`.
7. `src/abilities/` — способность игрока, не сосед на поле. `ArtilleryStrikeAbility` — числа залпа, падение снаряда и разрыв. `EmpFlashAbility` — числа ЭМИ, луч и полусфера. `AbilityList` — ряд иконок над лентой. `AutoFireAbilityIcon`, `AutoAimAbilityIcon`, `AutoShopAbilityIcon` — круги справа, покупка и выключатель лежат в прогрессе. `EnemyDamageDebugAbility` — флаг урона врагов, только дебаг-партия.
8. `src/ui/huds/GameHud.ts` — счёт, волна, монеты, полоска HP, баннер с номером версии из `package.json` в тёмной плашке справа от названия и левее кнопки «?», иконки способностей, выключатели автоприменения на иконках артиллерии, ионной пушки, мин, энергетической стены и бомбардировщика, выключатели автострельбы, автонаведения и автопокупки, кнопка «КЛАВИШИ» и экран паузы. Шестерёнка стоит вплотную к паузе. В дебаге `DebugGameHud.ts` вставляет между ними кнопки тихой паузы, перезапуска волны, пропуска волны и проигрыша. `src/ui/shops/ShopPanel.ts` и `ProgressShopPanel.ts` — витрины. В дебаге `DebugShopPanel.ts` и `DebugProgressShopPanel.ts` добавляют «+» слева от знака. Досыпку по `M` и «+» делают `DebugShopController` и `DebugProgressShopController`. `src/ui/settings/SettingsPanel.ts` — окно громкости, переключатель паузы при потере фокуса и язык. `src/ui/difficulty/DifficultyPanel.ts` — выбор сложности. Тексты экрана лежат в `src/locale`: у языка свой файл, `index.ts` собирает список.
9. `src/gfx/` — цвета, огонь, воронки, гриб, разрыв авиабомбы, искры и разрез спрайта. `ensureGameTextures.ts` запекает картинки перед боем.
10. `src/saves/CombatSave.ts` — запись партии. `ProgressSave` — очки и постоянные уровни. `src/difficulty.ts` — список сложностей и выбранная строка. `src/shopPrice.ts` подменяет любую цену на 1 в сборке `build:html:gift`, иначе множит её этой строкой.

Числа баланса лежат рядом с тем, кто их использует. Состав волны — `EnemyFactory.wave` и поле `debutWave` у врага. Выстрел танка — класс `Tank`. Перезарядка и полёт пулемёта — класс `MachineGun`. Разовые цены — поле `shop` у покупки. Откат и залп артиллерии — `ArtilleryStrikeAbilityConfig`. Откат и глушение ЭМИ — `EmpFlashAbilityConfig`. Повторяемая цена монет — `ShopController.upgradeCost`, `flightCost`, `knockbackCost` и `pierceCost`. Цены очков — `ProgressSave.cost`, `bulletCost`, `mgDamageCost`, `knockbackCost`, `pierceCost`, `countCost`, `autoFireCost`, `autoAimCost`, `autoShopCost`, `autoArtilleryCost`, `autoIonCost`, `autoMinesCost`, `autoBomberCost`, `autoWallCost`, `wallDurationCost`, `wallCooldownCost` и `empStunCost`.

Стек: [Phaser 4](https://phaser.io/), TypeScript, Vite.
