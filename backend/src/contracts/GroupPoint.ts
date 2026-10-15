export interface GroupPoint {
    updatePoint(group: number, update: number): void
    getPoint(group: number): number
}