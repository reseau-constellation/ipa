export const pathJoin = (...paths: string[]) => paths
  .join('/')
  .replace(/((?<=\/)\/+)|(^\.\/)|((?<=\/)\.\/)/g, '') || '.'
  