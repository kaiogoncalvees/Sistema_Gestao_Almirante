// Centros de custo da empresa.
// Para adicionar ou remover uma loja, edite apenas este array.
export const CENTROS_CUSTO = ['Ilha', 'Tropical'] as const;

export type CentroCusto = typeof CENTROS_CUSTO[number];
