export class EscPosBuilder {
  private buffer: Buffer[] = [];

  constructor() {
    // Initialize ESC/POS
    this.buffer.push(Buffer.from([0x1b, 0x40]));
  }

  initialize(): this {
    this.buffer.push(Buffer.from([0x1b, 0x40]));
    return this;
  }

  alignLeft(): this {
    this.buffer.push(Buffer.from([0x1b, 0x61, 0x00]));
    return this;
  }

  alignCenter(): this {
    this.buffer.push(Buffer.from([0x1b, 0x61, 0x01]));
    return this;
  }

  alignRight(): this {
    this.buffer.push(Buffer.from([0x1b, 0x61, 0x02]));
    return this;
  }

  bold(enable: boolean): this {
    this.buffer.push(Buffer.from([0x1b, 0x45, enable ? 0x01 : 0x00]));
    return this;
  }

  text(content: string): this {
    this.buffer.push(Buffer.from(content, 'utf-8'));
    return this;
  }

  newline(): this {
    this.buffer.push(Buffer.from('\n'));
    return this;
  }

  feed(lines: number = 1): this {
    this.buffer.push(Buffer.from([0x1b, 0x64, lines]));
    return this;
  }

  cut(): this {
    // Feed and cut (partial cut if supported)
    this.buffer.push(Buffer.from([0x1d, 0x56, 0x00]));
    return this;
  }

  setSize(width: 'normal' | 'double', height: 'normal' | 'double'): this {
    const widthByte = width === 'double' ? 0x01 : 0x00;
    const heightByte = height === 'double' ? 0x01 : 0x00;
    this.buffer.push(Buffer.from([0x1d, 0x21, (heightByte << 4) | widthByte]));
    return this;
  }

  build(): Buffer {
    return Buffer.concat(this.buffer);
  }
}
