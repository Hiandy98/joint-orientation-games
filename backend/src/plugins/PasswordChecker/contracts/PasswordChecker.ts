export interface PasswordChecker {
    getPasswordLength(area: number, level: number): number | undefined
    checkPassword(area: number, level: number, password: number): boolean | undefined
}