const OPENPHONE_API_URL = "https://api.openphone.com/v1";

export async function sendSms(to: string, text: string): Promise<{ messageId?: string }> {
  const apiKey = process.env.OPENPHONE_API_KEY;
  const phoneNumberId = process.env.OPENPHONE_PHONE_NUMBER_ID;

  if (!apiKey || !phoneNumberId) {
    throw new Error("OpenPhone credentials not configured");
  }

  const res = await fetch(`${OPENPHONE_API_URL}/messages`, {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: text,
      from: phoneNumberId,
      to: [to],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenPhone API error: ${res.status} - ${body}`);
  }

  const json = await res.json();
  return { messageId: json.data?.id };
}
