export interface PasswordChecker {
    checkPassword(stage: number, area: number, password: string): boolean | undefined
}