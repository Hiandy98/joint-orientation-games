export interface PasswordChecker {
    getPasswordLength(area: number, level: number): number
    checkPassword(password: number): boolean
}