declare module 'virtual:about-config' {
  export interface ThankItem {
    name: string
    contribution: string
  }

  export interface CoffeeItem {
    label: string
    url: string
  }

  export const aboutConfig: {
    sponsors: string[]
    thanks: ThankItem[]
    coffee: CoffeeItem[]
  }
}
