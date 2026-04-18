// ВАЖНО: только часть с download изменена, остальное оставь как есть

const handleDownload = async (_withWatermark = false) => {
  if (!resultImage) return;

  try {
    const fileName = `ai-photo-${Date.now()}.png`;

    // ✅ Если base64 (data:image)
    if (resultImage.startsWith('data:')) {
      const a = document.createElement('a');
      a.href = resultImage;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    // ✅ Если обычный URL → скачиваем через blob
    const response = await fetch(resultImage);

    if (!response.ok) {
      throw new Error('Не удалось загрузить изображение');
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    }, 100);

  } catch (err) {
    console.error('Download failed:', err);

    // fallback (на случай CORS)
    window.open(resultImage, '_blank');
  }
};
