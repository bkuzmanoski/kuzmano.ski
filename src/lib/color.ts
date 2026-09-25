export type Rgb = readonly [number, number, number];

export function rgbOfCssColor(context: CanvasRenderingContext2D, color: string): Rgb {
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;

  return [red, green, blue];
}
