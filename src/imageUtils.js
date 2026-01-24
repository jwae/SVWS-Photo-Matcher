// imageUtils.js
export function scaleImage(url, tw, th) {
  return new Promise(res => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      const cvs = document.createElement('canvas');
      cvs.width = tw;
      cvs.height = th;
      const ctx = cvs.getContext('2d');
      ctx.fillStyle = "#FFF";
      ctx.fillRect(0, 0, tw, th);

      const sourceAspect = img.width / img.height;
      const targetAspect = tw / th;
      let drawWidth, drawHeight, offsetX, offsetY;

      if (sourceAspect > targetAspect) {
        drawWidth = tw;
        drawHeight = tw / sourceAspect;
        offsetX = 0;
        offsetY = (th - drawHeight) / 2;
      } else {
        drawHeight = th;
        drawWidth = th * sourceAspect;
        offsetX = (tw - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      res(cvs.toDataURL('image/jpeg', 0.90));
    };
  });
}