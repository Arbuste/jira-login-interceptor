interface Props {
  webhookUrl: string;
  apiKey: string;
}

export default function DownloadConfigButton({ webhookUrl, apiKey }: Props) {
  const handleDownload = () => {
    const config = {
      forgeEndpointUrl: webhookUrl,
      apiKey,
    };
    const blob = new Blob([JSON.stringify(config, null, 2) + '\n'], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      className="btn-primary"
      onClick={handleDownload}
      disabled={!webhookUrl || !apiKey}
      type="button"
    >
      Download config.json
    </button>
  );
}
