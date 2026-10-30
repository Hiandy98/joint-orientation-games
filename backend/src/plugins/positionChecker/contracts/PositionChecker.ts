export interface PositionChecker {
  checkPosition(x: number, y: number): number | undefined;
}