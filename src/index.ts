#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { Innertube } from 'youtubei.js';

const mcpServer = new McpServer({
  name: 'mcp-youtube',
  version: '1.0.0',
  title: 'YouTube Transcription MCP Server'
});

// Simple tool registration using MCP SDK
mcpServer.registerTool("hello", {
  description: "Say hello with a personalized greeting",
  inputSchema: {
    name: z.string().optional().describe("Name to greet (optional)"),
  },
}, async ({ name }) => {
  const greeting = name ? `Hello, ${name}!` : "Hello, World!";
  return {
    content: [
      {
        type: "text",
        text: greeting,
      },
    ],
  };
});

mcpServer.registerTool("transcribe_youtube", {
  description: "Extract transcript from YouTube video using InnerTube API",
  inputSchema: {
    url: z.string().describe("YouTube video URL"),
  },
  outputSchema: {
    video_id: z.string(),
    title: z.string(),
    uploader: z.string(),
    duration: z.number().int().describe("seconds"),
    url: z.string(),
    transcript: z.array(
      z.object({
        start: z.number().int().describe("seconds"),
        duration: z.number().int().describe("seconds"),
        text: z.string(),
      })
    ),
    metadata: z.object({
      transcription_date: z.string().describe("ISO Datetime"),
      source: z.enum(["youtube_innertube"]),
      language: z.string(),
      confidence: z.number().min(0).max(1)
    })
  },
}, async ({ url }) => {
  // const COOKIE = '__Secure-1PSIDTS=sidts-CjIB5H03P0oGPBYBy_XGXiVmdCmVkr1uDH7r28SE48e1qIEWRnfWh34aCWfE0yucR3zJ1BAA; __Secure-3PSIDTS=sidts-CjIB5H03P0oGPBYBy_XGXiVmdCmVkr1uDH7r28SE48e1qIEWRnfWh34aCWfE0yucR3zJ1BAA; HSID=ATeU-_PN5oPAUUF84; SSID=AiPd92IYfaL31qW8w; APISID=Nb85f5XLh25MQ3Rq/AGZOvZ2blp4m9Vrrg; SAPISID=eeHllStqmVhVwtd3/Ax-9o9O_7nWFscY4u; __Secure-1PAPISID=eeHllStqmVhVwtd3/Ax-9o9O_7nWFscY4u; __Secure-3PAPISID=eeHllStqmVhVwtd3/Ax-9o9O_7nWFscY4u; SID=g.a000zgj7g1QhIPsglfVJ8rWNA_DUUZ-8Gdv9tXkzuPXEf1BfayzDStNMLBSivvQrqSDskOWBZgACgYKAU0SARYSFQHGX2MiH2DwO1j8c_PxpnKrHLlr-xoVAUF8yKotAtvOW2AuHM0_cDnO3QD70076; __Secure-1PSID=g.a000zgj7g1QhIPsglfVJ8rWNA_DUUZ-8Gdv9tXkzuPXEf1BfayzDwF1sF7m_2xFOZxpM4KjbvAACgYKAS0SARYSFQHGX2MixCKg-okPWiGWW5OZmF9PQBoVAUF8yKr9uBD99Ob6slNqVD5o1-v20076; __Secure-3PSID=g.a000zgj7g1QhIPsglfVJ8rWNA_DUUZ-8Gdv9tXkzuPXEf1BfayzDAdMAoPdZBP4CYCtEZ8KGFQACgYKAR8SARYSFQHGX2Mi79dZgDH_M5qK9cWOtJomFBoVAUF8yKoMccF-2JYJECO8wp3Fj5HT0076; LOGIN_INFO=AFmmF2swRgIhAPMWCIn8F-OGavMLije7nynxP2JGaddU_oTHzHX4Ka1WAiEAmb9PUB_tlh8em8sIK-fj_21Gb_BU0SCjN4fQ5Fk-OmI:QUQ3MjNmeU9xLWdiekxzdVo3aXJXbGJaM0MyTkhWNm9kRG9GWjFQSGZRT1RXTTc5WnJ5MlFPeXlXMTNUQnFYQlNQNVFSMVVrTEJuZEtLVE8yZ1l3SWhOcnRNWm5oRThPc003QXlSc3ZKTGc5Q3dNRjRaenF0WVVJVk9keGVZU0QydTFubFBqVENKLWVaeElwUkhodnNFVF8wV3pLWVZ1VDJR; YSC=eHLQMZJRrYo; VISITOR_INFO1_LIVE=-CiFGMs4euk; VISITOR_PRIVACY_METADATA=CgJVUxIEGgAgbQ%3D%3D; __Secure-ROLLOUT_TOKEN=CPiOtdSYm-a_QhD50o6m8t-OAxio_JSm8t-OAw%3D%3D; ST-3opvp5=session_logininfo=AFmmF2swRgIhAPMWCIn8F-OGavMLije7nynxP2JGaddU_oTHzHX4Ka1WAiEAmb9PUB_tlh8em8sIK-fj_21Gb_BU0SCjN4fQ5Fk-OmI%3AQUQ3MjNmeU9xLWdiekxzdVo3aXJXbGJaM0MyTkhWNm9kRG9GWjFQSGZRT1RXTTc5WnJ5MlFPeXlXMTNUQnFYQlNQNVFSMVVrTEJuZEtLVE8yZ1l3SWhOcnRNWm5oRThPc003QXlSc3ZKTGc5Q3dNRjRaenF0WVVJVk9keGVZU0QydTFubFBqVENKLWVaeElwUkhodnNFVF8wV3pLWVZ1VDJR; ST-1k7sl4x=itct=CI0DENwwIhMI1_WfsfLfjgMVjYXkBh2xww1CMgpnLWhpZ2gtcmVjWg9GRXdoYXRfdG9fd2F0Y2iaAQYQjh4YngE%3D&csn=_g2B6kZTmLBTRpUV&session_logininfo=AFmmF2swRgIhAPMWCIn8F-OGavMLije7nynxP2JGaddU_oTHzHX4Ka1WAiEAmb9PUB_tlh8em8sIK-fj_21Gb_BU0SCjN4fQ5Fk-OmI%3AQUQ3MjNmeU9xLWdiekxzdVo3aXJXbGJaM0MyTkhWNm9kRG9GWjFQSGZRT1RXTTc5WnJ5MlFPeXlXMTNUQnFYQlNQNVFSMVVrTEJuZEtLVE8yZ1l3SWhOcnRNWm5oRThPc003QXlSc3ZKTGc5Q3dNRjRaenF0WVVJVk9keGVZU0QydTFubFBqVENKLWVaeElwUkhodnNFVF8wV3pLWVZ1VDJR&endpoint=%7B%22clickTrackingParams%22%3A%22CI0DENwwIhMI1_WfsfLfjgMVjYXkBh2xww1CMgpnLWhpZ2gtcmVjWg9GRXdoYXRfdG9fd2F0Y2iaAQYQjh4YngE%3D%22%2C%22commandMetadata%22%3A%7B%22webCommandMetadata%22%3A%7B%22url%22%3A%22%2Fwatch%3Fv%3DvcbppfqXweE%26pp%3DugUHEgVlbi1HQg%253D%253D%22%2C%22webPageType%22%3A%22WEB_PAGE_TYPE_WATCH%22%2C%22rootVe%22%3A3832%7D%7D%2C%22watchEndpoint%22%3A%7B%22videoId%22%3A%22vcbppfqXweE%22%2C%22playerParams%22%3A%22ugUHEgVlbi1HQg%253D%253D%22%2C%22ustreamerConfig%22%3A%22KgkKBxIFZW4tR0I%3D%22%2C%22watchEndpointSupportedOnesieConfig%22%3A%7B%22html5PlaybackOnesieConfig%22%3A%7B%22commonConfig%22%3A%7B%22url%22%3A%22https%3A%2F%2Frr5---sn-ab5l6nr6.googlevideo.com%2Finitplayback%3Fsource%3Dyoutube%26oeis%3D1%26c%3DWEB%26oad%3D3200%26ovd%3D3200%26oaad%3D11000%26oavd%3D11000%26ocs%3D700%26oewis%3D1%26oputc%3D1%26ofpcc%3D1%26siu%3D1%26msp%3D1%26odepv%3D1%26onvi%3D1%26id%3Dbdc6e9a5fa97c1e1%26ip%3D38.77.58.230%26initcwndbps%3D3781250%26mt%3D1753717057%26oweuc%3D%22%7D%7D%7D%7D%7D; SIDCC=AKEyXzVs0Xno1qaZn7E0Ax-XMBf-CXRdqtBkQafLaBImnALq4oOfWinJdUvC5HUxGndpKtMt; __Secure-1PSIDCC=AKEyXzVcFouLhpG05WQf9ddFw5JC_N_BjtDN5vywpSAzlXF7jtjCvNa7tDoE8-4Zo7nDE6X5Sg; __Secure-3PSIDCC=AKEyXzVYsjA1jo6uuflH7oqjHzta5AkUzEf3gE5ZEEaJ8DMVPz2VLwW6aB0ZstRux4wloKR63g; PREF=f6=40000080&tz=America.New_York&f5=30000&f7=100';

  const InnerTubeClient = await Innertube.create({
    retrieve_player: false
  });

  const info = await InnerTubeClient.getInfo(url);
  const title = info.basic_info.title ?? "TITLE NOT FOUND";
  const uploader = info.basic_info.channel?.name ?? "CHANNEL NOT FOUND";
  const videoId = info.basic_info.id ?? "VIDEO ID NOT FOUND";
  const transcript = await info.getTranscript();
  console.error(transcript);

  return {
    content: [{
      type: 'text',
      text: "Response: "
    }],
    structuredContent: {
      url: url,
      duration: 0,
      metadata: {
        confidence: 0,
        language: "EN",
        source: "youtube_innertube",
        transcription_date: new Date().toISOString()
      },
      title: title,
      transcript: [{
        duration: 0,
        start: 0,
        text: "NO TRANSCRIPTION FOUND"
      }],
      uploader: uploader,
      video_id: videoId
    },
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await mcpServer.connect(transport);
  console.error('MCP YouTube server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});