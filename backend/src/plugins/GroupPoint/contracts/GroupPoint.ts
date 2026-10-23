export interface GroupPoint {
    //group 為 0 1 2 3 組別係數
    updatePoint(group: number, update: number): Promise<void>
    getPoint(group: number): Promise<number>
}