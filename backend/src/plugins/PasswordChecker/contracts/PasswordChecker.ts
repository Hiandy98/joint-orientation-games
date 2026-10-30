export interface PasswordChecker {
    checkPassword(stage: number, area: number, password: number): boolean | undefined
}