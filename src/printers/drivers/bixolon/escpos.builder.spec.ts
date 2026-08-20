import { EscPosBuilder } from './escpos.builder';

describe('EscPosBuilder', () => {
  it('should initialize', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.build();
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('should add text', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.text('Hello World').build();
    expect(buffer.toString()).toContain('Hello World');
  });

  it('should add newline', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.text('Hello').newline().text('World').build();
    expect(buffer.toString()).toContain('Hello\nWorld');
  });

  it('should align center', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.alignCenter().text('Centered').build();
    expect(buffer).toBeDefined();
  });

  it('should enable bold', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.bold(true).text('Bold').build();
    expect(buffer).toBeDefined();
  });

  it('should feed paper', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.feed(3).build();
    expect(buffer).toBeDefined();
  });

  it('should cut paper', () => {
    const builder = new EscPosBuilder();
    const buffer = builder.cut().build();
    expect(buffer).toBeDefined();
  });

  it('should build a complete ticket', () => {
    const builder = new EscPosBuilder();
    const buffer = builder
      .initialize()
      .alignCenter()
      .bold(true)
      .text('MI TIENDA')
      .newline()
      .bold(false)
      .text('Venta #1234')
      .newline()
      .alignLeft()
      .text('Producto       $3.990')
      .newline()
      .feed(3)
      .cut()
      .build();
    
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    expect(buffer.toString()).toContain('MI TIENDA');
    expect(buffer.toString()).toContain('Venta #1234');
    expect(buffer.toString()).toContain('Producto       $3.990');
  });
});
