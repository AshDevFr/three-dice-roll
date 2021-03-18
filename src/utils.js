export const hexToRGB = (hex) =>
  hex
    .replace(
      /^#?([a-f\d])([a-f\d])([a-f\d])$/i,
      (match, r, g, b) => "#" + r + r + g + g + b + b
    )
    .substring(1)
    .match(/.{2}/g)
    .map((x) => parseInt(x, 16));

export const colorToRGB = (value) => {
  let tmpEl = document.createElement("div");
  tmpEl.style.color = value;
  document.body.appendChild(tmpEl);

  const cs = window.getComputedStyle(tmpEl);
  const pv = cs.getPropertyValue("color");

  document.body.removeChild(tmpEl);

  return pv;
};

export const gradientColorStep = (colorString1, colorString2, step) => {
  const color1 = colorString1.match(/\d+/g).slice(0, 3);
  const color2 = colorString2.match(/\d+/g).slice(0, 3);
  const diff = 1 - step;
  const rgb = [
    Math.round(color1[0] * step + color2[0] * diff),
    Math.round(color1[1] * step + color2[1] * diff),
    Math.round(color1[2] * step + color2[2] * diff),
  ];
  return `rgb(${rgb.join(",")})`;
};
