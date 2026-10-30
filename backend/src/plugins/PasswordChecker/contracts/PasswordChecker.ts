export interface PasswordChecker {
    checkPassword(area: number, level: number, password: number): boolean | undefined
}