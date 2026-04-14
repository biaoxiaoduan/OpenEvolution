export class CollectionError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "CollectionError";
  }
}

export class AnalysisError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "AnalysisError";
  }
}

export class RenderingError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "RenderingError";
  }
}
