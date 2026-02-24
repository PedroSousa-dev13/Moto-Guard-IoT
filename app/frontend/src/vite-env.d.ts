/// <reference types="vite/client" />

// Permitir imports de CSS
declare module "*.css" {}

// Permitir imports de imagens
declare module "*.png" {
  const src: string;
  export default src;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "*.svg" {
  const src: string;
  export default src;
}
