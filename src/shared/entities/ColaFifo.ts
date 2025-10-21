class ColaFIFO<T> {
  private elementos: T[] = [];

  encolar(elemento: T) {
    this.elementos.push(elemento);
  }

  desencolar(): T | undefined {
    return this.elementos.shift();
  }

  frente(): T | undefined {
    return this.elementos[0];
  }

  estaVacia(): boolean {
    return this.elementos.length === 0;
  }

  obtenerTodos(): T[] {
    return [...this.elementos];
  }
}
