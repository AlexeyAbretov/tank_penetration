import Phaser from 'phaser';
// Точки с зазором, чтобы воронки не легли друг на друга.
// minX приходит снаружи: артиллерия не знает, где стоит проволока.
export const calculateImpacts = (
    count: number,
    minX: number,
    minGap: number,
    field: { maxX: number; minY: number; maxY: number },
): { x: number; y: number }[] => {
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i < count; i += 1) {
        let point = randomPoint(minX, field);

        for (let attempt = 0; attempt < 10; attempt += 1) {
            const clear = points.every(
                (other) => Phaser.Math.Distance.Between(other.x, other.y, point.x, point.y) >= minGap,
            );

            if (clear) {
                break;
            }

            point = randomPoint(minX, field);
        }

        points.push(point);
    }

    return points;
}

const randomPoint = (minX: number, field: { maxX: number; minY: number; maxY: number }): { x: number; y: number } => {
    return {
        x: Phaser.Math.Between(minX, field.maxX),
        y: Phaser.Math.Between(field.minY, field.maxY),
    };
}