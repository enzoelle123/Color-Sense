const FILTER_TYPES = {
  normal: {
    label: 'Normal',
    description: 'Visão de cores padrão, sem filtro aplicado.',
    matrix: [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 1, 0
    ]
  },
  protanopia: {
    label: 'Protanopia',
    description: 'Ausência de cones vermelhos. Dificuldade de distinguir vermelho e verde.',
    matrix: [
      0.567, 0.433, 0,     0, 0,
      0.558, 0.442, 0,     0, 0,
      0,     0.242, 0.758, 0, 0,
      0,     0,     0,     1, 0
    ]
  },
  protanomalia: {
    label: 'Protanomalia',
    description: 'Deficiência leve de cones vermelhos.',
    matrix: [
      0.817, 0.183, 0,     0, 0,
      0.333, 0.667, 0,     0, 0,
      0,     0.125, 0.875, 0, 0,
      0,     0,     0,     1, 0
    ]
  },
  deuteranopia: {
    label: 'Deuteranopia',
    description: 'Ausência de cones verdes. Tipo mais comum (~8% dos homens).',
    matrix: [
      0.625, 0.375, 0,   0, 0,
      0.7,   0.3,   0,   0, 0,
      0,     0.3,   0.7, 0, 0,
      0,     0,     0,   1, 0
    ]
  },
  deuteranomalia: {
    label: 'Deuteranomalia',
    description: 'Deficiência leve de cones verdes.',
    matrix: [
      0.8,   0.2,   0,   0, 0,
      0.258, 0.742, 0,   0, 0,
      0,     0.142, 0.858, 0, 0,
      0,     0,     0,   1, 0
    ]
  },
  tritanopia: {
    label: 'Tritanopia',
    description: 'Ausência de cones azuis. Dificuldade com azul e amarelo.',
    matrix: [
      0.95,  0.05,  0,     0, 0,
      0,     0.433, 0.567, 0, 0,
      0,     0.475, 0.525, 0, 0,
      0,     0,     0,     1, 0
    ]
  },
  tritanomalia: {
    label: 'Tritanomalia',
    description: 'Deficiência leve de cones azuis.',
    matrix: [
      0.967, 0.033, 0,     0, 0,
      0,     0.733, 0.267, 0, 0,
      0,     0.183, 0.817, 0, 0,
      0,     0,     0,     1, 0
    ]
  },
  achromatopsia: {
    label: 'Acromatopsia',
    description: 'Ausência total de percepção de cor. Visão em escala de cinza.',
    matrix: [
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0.299, 0.587, 0.114, 0, 0,
      0,     0,     0,     1, 0
    ]
  },
  achromatomaly: {
    label: 'Acromatomalia',
    description: 'Redução parcial da percepção de cor.',
    matrix: [
      0.618, 0.320, 0.062, 0, 0,
      0.163, 0.775, 0.062, 0, 0,
      0.163, 0.320, 0.516, 0, 0,
      0,     0,     0,     1, 0
    ]
  }
};

function getFilter(type) {
  return FILTER_TYPES[type] || FILTER_TYPES.normal;
}

function getSvgFilterDef(type, id = 'colorsense-filter') {
  const filter = getFilter(type);
  const matrixStr = filter.matrix.join(' ');
  return `<filter id="${id}"><feColorMatrix type="matrix" values="${matrixStr}"/></filter>`;
}

function getAllTypes() {
  return Object.entries(FILTER_TYPES).map(([key, val]) => ({
    key,
    label: val.label,
    description: val.description
  }));
}

module.exports = { FILTER_TYPES, getFilter, getSvgFilterDef, getAllTypes };
