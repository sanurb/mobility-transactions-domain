/**
 * @fileoverview
 * MIME type constants for HTTP content negotiation.
 *
 * Defines:
 *  - `MimeType` and `MimeTypeRecord`
 *  - Organized by IANA media type categories
 *
 * @see https://www.iana.org/assignments/media-types/media-types.xhtml
 * @see https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types
 */

//////////////////
// TEXT MIME TYPES
//////////////////

/**
 * Text-based content types.
 * @see https://www.iana.org/assignments/media-types/text
 */
const TEXT_MIME_TYPES = {
  /**
   * Plain text content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/plain)
   */
  plain: "text/plain",

  /**
   * HTML content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/html)
   */
  html: "text/html",

  /**
   * CSS stylesheets.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/css)
   */
  css: "text/css",

  /**
   * JavaScript code.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/javascript)
   */
  javascript: "text/javascript",

  /**
   * JSON data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/json)
   */
  json: "application/json",

  /**
   * XML content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/xml)
   */
  xml: "application/xml",

  /**
   * CSV data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/csv)
   */
  csv: "text/csv",

  /**
   * Markdown content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/markdown)
   */
  markdown: "text/markdown",

  /**
   * Rich Text Format.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/text/rtf)
   */
  rtf: "text/rtf",

  /**
   * YAML content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/x-yaml)
   */
  yaml: "application/x-yaml",

  /**
   * TypeScript code.
   */
  typescript: "text/typescript",

  /**
   * JavaScript module.
   */
  jsModule: "text/javascript; charset=utf-8",

  /**
   * TypeScript module.
   */
  tsModule: "text/typescript; charset=utf-8",
} as const;

type TextMimeType = (typeof TEXT_MIME_TYPES)[keyof typeof TEXT_MIME_TYPES];

//////////////////////
// APPLICATION MIME TYPES
//////////////////////

/**
 * Application-specific content types.
 * @see https://www.iana.org/assignments/media-types/application
 */
const APPLICATION_MIME_TYPES = {
  /**
   * JSON data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/json)
   */
  json: "application/json",

  /**
   * XML content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/xml)
   */
  xml: "application/xml",

  /**
   * PDF documents.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/pdf)
   */
  pdf: "application/pdf",

  /**
   * ZIP archives.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/zip)
   */
  zip: "application/zip",

  /**
   * GZIP compressed data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/gzip)
   */
  gzip: "application/gzip",

  /**
   * TAR archives.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/x-tar)
   */
  tar: "application/x-tar",

  /**
   * 7-Zip archives.
   */
  sevenZip: "application/x-7z-compressed",

  /**
   * RAR archives.
   */
  rar: "application/vnd.rar",

  /**
   * Microsoft Word documents.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.openxmlformats-officedocument.wordprocessingml.document)
   */
  word: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  /**
   * Microsoft Excel spreadsheets.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)
   */
  excel: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

  /**
   * Microsoft PowerPoint presentations.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.openxmlformats-officedocument.presentationml.presentation)
   */
  powerpoint:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  /**
   * OpenDocument Text.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.oasis.opendocument.text)
   */
  openDocumentText: "application/vnd.oasis.opendocument.text",

  /**
   * OpenDocument Spreadsheet.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.oasis.opendocument.spreadsheet)
   */
  openDocumentSpreadsheet: "application/vnd.oasis.opendocument.spreadsheet",

  /**
   * OpenDocument Presentation.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/vnd.oasis.opendocument.presentation)
   */
  openDocumentPresentation: "application/vnd.oasis.opendocument.presentation",

  /**
   * Binary data.
   */
  octetStream: "application/octet-stream",

  /**
   * Form data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/x-www-form-urlencoded)
   */
  formUrlencoded: "application/x-www-form-urlencoded",

  /**
   * Multipart form data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/form-data)
   */
  multipartFormData: "multipart/form-data",

  /**
   * GraphQL queries.
   */
  graphql: "application/graphql",

  /**
   * GraphQL JSON responses.
   */
  graphqlJson: "application/graphql+json",

  /**
   * LD+JSON structured data.
   */
  ldJson: "application/ld+json",

  /**
   * Web App Manifest.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/manifest+json)
   */
  manifestJson: "application/manifest+json",

  /**
   * WebAssembly binary.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/wasm)
   */
  wasm: "application/wasm",

  /**
   * Protocol Buffers.
   */
  protobuf: "application/x-protobuf",

  /**
   * MessagePack.
   */
  messagePack: "application/msgpack",

  /**
   * BSON (Binary JSON).
   */
  bson: "application/bson",

  /**
   * CBOR (Concise Binary Object Representation).
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/cbor)
   */
  cbor: "application/cbor",

  /**
   * YAML content.
   */
  yaml: "application/x-yaml",

  /**
   * TOML content.
   */
  toml: "application/toml",

  /**
   * INI configuration files.
   */
  ini: "text/plain",

  /**
   * SQL scripts.
   */
  sql: "application/sql",

  /**
   * GeoJSON data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/application/geo+json)
   */
  geoJson: "application/geo+json",

  /**
   * TopoJSON data.
   */
  topoJson: "application/topo+json",

  /**
   * MIME type for unknown content.
   */
  unknown: "application/octet-stream",
} as const;

type ApplicationMimeType =
  (typeof APPLICATION_MIME_TYPES)[keyof typeof APPLICATION_MIME_TYPES];

//////////////////
// IMAGE MIME TYPES
//////////////////

/**
 * Image content types.
 * @see https://www.iana.org/assignments/media-types/image
 */
const IMAGE_MIME_TYPES = {
  /**
   * JPEG images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/jpeg)
   */
  jpeg: "image/jpeg",

  /**
   * PNG images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/png)
   */
  png: "image/png",

  /**
   * GIF images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/gif)
   */
  gif: "image/gif",

  /**
   * WebP images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/webp)
   */
  webp: "image/webp",

  /**
   * SVG images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/svg+xml)
   */
  svg: "image/svg+xml",

  /**
   * ICO favicon images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/x-icon)
   */
  ico: "image/x-icon",

  /**
   * BMP images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/bmp)
   */
  bmp: "image/bmp",

  /**
   * TIFF images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/tiff)
   */
  tiff: "image/tiff",

  /**
   * AVIF images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/avif)
   */
  avif: "image/avif",

  /**
   * HEIC images.
   */
  heic: "image/heic",

  /**
   * HEIF images.
   */
  heif: "image/heif",

  /**
   * JPEG 2000 images.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/image/jp2)
   */
  jp2: "image/jp2",

  /**
   * JPEG XR images.
   */
  jxr: "image/jxr",

  /**
   * APNG images.
   */
  apng: "image/apng",

  /**
   * AV1 images.
   */
  av1: "image/av1",
} as const;

type ImageMimeType = (typeof IMAGE_MIME_TYPES)[keyof typeof IMAGE_MIME_TYPES];

//////////////////
// AUDIO MIME TYPES
//////////////////

/**
 * Audio content types.
 * @see https://www.iana.org/assignments/media-types/audio
 */
const AUDIO_MIME_TYPES = {
  /**
   * MP3 audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/mpeg)
   */
  mp3: "audio/mpeg",

  /**
   * WAV audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/wav)
   */
  wav: "audio/wav",

  /**
   * OGG audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/ogg)
   */
  ogg: "audio/ogg",

  /**
   * FLAC audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/flac)
   */
  flac: "audio/flac",

  /**
   * AAC audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/aac)
   */
  aac: "audio/aac",

  /**
   * WebM audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/webm)
   */
  webm: "audio/webm",

  /**
   * M4A audio.
   */
  m4a: "audio/mp4",

  /**
   * Opus audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/opus)
   */
  opus: "audio/opus",

  /**
   * MIDI audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/midi)
   */
  midi: "audio/midi",

  /**
   * AIFF audio.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/audio/aiff)
   */
  aiff: "audio/aiff",
} as const;

type AudioMimeType = (typeof AUDIO_MIME_TYPES)[keyof typeof AUDIO_MIME_TYPES];

//////////////////
// VIDEO MIME TYPES
//////////////////

/**
 * Video content types.
 * @see https://www.iana.org/assignments/media-types/video
 */
const VIDEO_MIME_TYPES = {
  /**
   * MP4 video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/mp4)
   */
  mp4: "video/mp4",

  /**
   * WebM video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/webm)
   */
  webm: "video/webm",

  /**
   * OGG video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/ogg)
   */
  ogg: "video/ogg",

  /**
   * AVI video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/x-msvideo)
   */
  avi: "video/x-msvideo",

  /**
   * MOV video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/quicktime)
   */
  mov: "video/quicktime",

  /**
   * WMV video.
   */
  wmv: "video/x-ms-wmv",

  /**
   * FLV video.
   */
  flv: "video/x-flv",

  /**
   * 3GP video.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/video/3gpp)
   */
  threeGp: "video/3gpp",

  /**
   * MKV video.
   */
  mkv: "video/x-matroska",

  /**
   * M4V video.
   */
  m4v: "video/x-m4v",

  /**
   * H.264 video.
   */
  h264: "video/h264",

  /**
   * H.265 video.
   */
  h265: "video/h265",

  /**
   * VP8 video.
   */
  vp8: "video/vp8",

  /**
   * VP9 video.
   */
  vp9: "video/vp9",

  /**
   * AV1 video.
   */
  av1: "video/av1",
} as const;

type VideoMimeType = (typeof VIDEO_MIME_TYPES)[keyof typeof VIDEO_MIME_TYPES];

//////////////////
// FONT MIME TYPES
//////////////////

/**
 * Font content types.
 * @see https://www.iana.org/assignments/media-types/font
 */
const FONT_MIME_TYPES = {
  /**
   * WOFF fonts.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/font/woff)
   */
  woff: "font/woff",

  /**
   * WOFF2 fonts.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/font/woff2)
   */
  woff2: "font/woff2",

  /**
   * TTF fonts.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/font/ttf)
   */
  ttf: "font/ttf",

  /**
   * OTF fonts.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/font/otf)
   */
  otf: "font/otf",

  /**
   * EOT fonts.
   */
  eot: "application/vnd.ms-fontobject",

  /**
   * Collection fonts.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/font/collection)
   */
  collection: "font/collection",
} as const;

type FontMimeType = (typeof FONT_MIME_TYPES)[keyof typeof FONT_MIME_TYPES];

//////////////////
// MODEL MIME TYPES
//////////////////

/**
 * 3D model content types.
 * @see https://www.iana.org/assignments/media-types/model
 */
const MODEL_MIME_TYPES = {
  /**
   * GLTF models.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/model/gltf+json)
   */
  gltf: "model/gltf+json",

  /**
   * GLB models.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/model/gltf-binary)
   */
  glb: "model/gltf-binary",

  /**
   * OBJ models.
   */
  obj: "text/plain",

  /**
   * STL models.
   */
  stl: "model/stl",

  /**
   * PLY models.
   */
  ply: "model/ply",

  /**
   * 3DS models.
   */
  threeDs: "application/x-3ds",

  /**
   * FBX models.
   */
  fbx: "application/octet-stream",

  /**
   * DAE models.
   */
  dae: "model/vnd.collada+xml",
} as const;

type ModelMimeType = (typeof MODEL_MIME_TYPES)[keyof typeof MODEL_MIME_TYPES];

//////////////////
// MULTIPART MIME TYPES
//////////////////

/**
 * Multipart content types.
 * @see https://www.iana.org/assignments/media-types/multipart
 */
const MULTIPART_MIME_TYPES = {
  /**
   * Form data.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/form-data)
   */
  formData: "multipart/form-data",

  /**
   * Mixed content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/mixed)
   */
  mixed: "multipart/mixed",

  /**
   * Alternative content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/alternative)
   */
  alternative: "multipart/alternative",

  /**
   * Related content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/related)
   */
  related: "multipart/related",

  /**
   * Digest content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/digest)
   */
  digest: "multipart/digest",

  /**
   * Parallel content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/parallel)
   */
  parallel: "multipart/parallel",

  /**
   * Report content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/report)
   */
  report: "multipart/report",

  /**
   * Signed content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/signed)
   */
  signed: "multipart/signed",

  /**
   * Encrypted content.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/encrypted)
   */
  encrypted: "multipart/encrypted",

  /**
   * Byte ranges.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/multipart/byteranges)
   */
  byteRanges: "multipart/byteranges",
} as const;

type MultipartMimeType =
  (typeof MULTIPART_MIME_TYPES)[keyof typeof MULTIPART_MIME_TYPES];

//////////////////
// MESSAGE MIME TYPES
//////////////////

/**
 * Message content types.
 * @see https://www.iana.org/assignments/media-types/message
 */
const MESSAGE_MIME_TYPES = {
  /**
   * RFC 822 message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/rfc822)
   */
  rfc822: "message/rfc822",

  /**
   * Partial message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/partial)
   */
  partial: "message/partial",

  /**
   * External body message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/external-body)
   */
  externalBody: "message/external-body",

  /**
   * HTTP message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/http)
   */
  http: "message/http",

  /**
   * Disposition notification.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/disposition-notification)
   */
  dispositionNotification: "message/disposition-notification",

  /**
   * Global message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/global)
   */
  global: "message/global",

  /**
   * Global delivery status.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/global-delivery-status)
   */
  globalDeliveryStatus: "message/global-delivery-status",

  /**
   * Global disposition notification.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/global-disposition-notification)
   */
  globalDispositionNotification: "message/global-disposition-notification",

  /**
   * Report message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/report)
   */
  report: "message/report",

  /**
   * S-http message.
   *
   * [IANA Reference](https://www.iana.org/assignments/media-types/message/s-http)
   */
  sHttp: "message/s-http",
} as const;

type MessageMimeType =
  (typeof MESSAGE_MIME_TYPES)[keyof typeof MESSAGE_MIME_TYPES];

/**
 * All MIME types organized by category.
 */
export const MIME_TYPES = {
  ...TEXT_MIME_TYPES,
  ...APPLICATION_MIME_TYPES,
  ...IMAGE_MIME_TYPES,
  ...AUDIO_MIME_TYPES,
  ...VIDEO_MIME_TYPES,
  ...FONT_MIME_TYPES,
  ...MODEL_MIME_TYPES,
  ...MULTIPART_MIME_TYPES,
  ...MESSAGE_MIME_TYPES,

  /**
   * Text-based MIME types.
   */
  text: TEXT_MIME_TYPES,

  /**
   * Application-specific MIME types.
   */
  application: APPLICATION_MIME_TYPES,

  /**
   * Image MIME types.
   */
  image: IMAGE_MIME_TYPES,

  /**
   * Audio MIME types.
   */
  audio: AUDIO_MIME_TYPES,

  /**
   * Video MIME types.
   */
  video: VIDEO_MIME_TYPES,

  /**
   * Font MIME types.
   */
  font: FONT_MIME_TYPES,

  /**
   * 3D model MIME types.
   */
  model: MODEL_MIME_TYPES,

  /**
   * Multipart MIME types.
   */
  multipart: MULTIPART_MIME_TYPES,

  /**
   * Message MIME types.
   */
  message: MESSAGE_MIME_TYPES,
} as const;

/**
 * Union of all MIME type values.
 */
export type MimeType =
  | TextMimeType
  | ApplicationMimeType
  | ImageMimeType
  | AudioMimeType
  | VideoMimeType
  | FontMimeType
  | ModelMimeType
  | MultipartMimeType
  | MessageMimeType;

/**
 * A mapping from MIME type names to their string values.
 */
export type MimeTypeRecord = Partial<Record<MimeType, string>>;

/**
 * Text-based MIME type values.
 */
export type MimeTypeText = TextMimeType;

/**
 * Application-specific MIME type values.
 */
export type MimeTypeApplication = ApplicationMimeType;

/**
 * Image MIME type values.
 */
export type MimeTypeImage = ImageMimeType;

/**
 * Audio MIME type values.
 */
export type MimeTypeAudio = AudioMimeType;

/**
 * Video MIME type values.
 */
export type MimeTypeVideo = VideoMimeType;

/**
 * Font MIME type values.
 */
export type MimeTypeFont = FontMimeType;

/**
 * 3D model MIME type values.
 */
export type MimeTypeModel = ModelMimeType;

/**
 * Multipart MIME type values.
 */
export type MimeTypeMultipart = MultipartMimeType;

/**
 * Message MIME type values.
 */
export type MimeTypeMessage = MessageMimeType;

/**
 * Common MIME type groups for content negotiation.
 */
export const COMMON_MIME_GROUPS = {
  /**
   * Common text formats.
   */
  text: [
    MIME_TYPES.plain,
    MIME_TYPES.html,
    MIME_TYPES.css,
    MIME_TYPES.javascript,
    MIME_TYPES.json,
    MIME_TYPES.xml,
    MIME_TYPES.csv,
    MIME_TYPES.markdown,
  ] as const,

  /**
   * Common image formats.
   */
  image: [
    MIME_TYPES.jpeg,
    MIME_TYPES.png,
    MIME_TYPES.gif,
    MIME_TYPES.webp,
    MIME_TYPES.svg,
    MIME_TYPES.ico,
  ] as const,

  /**
   * Common audio formats.
   */
  audio: [
    MIME_TYPES.mp3,
    MIME_TYPES.wav,
    MIME_TYPES.ogg,
    MIME_TYPES.flac,
    MIME_TYPES.aac,
    MIME_TYPES.webm,
  ] as const,

  /**
   * Common video formats.
   */
  video: [
    MIME_TYPES.mp4,
    MIME_TYPES.webm,
    MIME_TYPES.ogg,
    MIME_TYPES.mov,
  ] as const,

  /**
   * Common document formats.
   */
  document: [
    MIME_TYPES.pdf,
    MIME_TYPES.word,
    MIME_TYPES.excel,
    MIME_TYPES.powerpoint,
    MIME_TYPES.openDocumentText,
    MIME_TYPES.openDocumentSpreadsheet,
    MIME_TYPES.openDocumentPresentation,
  ] as const,

  /**
   * Common archive formats.
   */
  archive: [
    MIME_TYPES.zip,
    MIME_TYPES.gzip,
    MIME_TYPES.tar,
    MIME_TYPES.sevenZip,
    MIME_TYPES.rar,
  ] as const,

  /**
   * Common font formats.
   */
  font: [
    MIME_TYPES.woff,
    MIME_TYPES.woff2,
    MIME_TYPES.ttf,
    MIME_TYPES.otf,
  ] as const,

  /**
   * Common data formats.
   */
  data: [
    MIME_TYPES.json,
    MIME_TYPES.xml,
    MIME_TYPES.yaml,
    MIME_TYPES.csv,
    MIME_TYPES.protobuf,
    MIME_TYPES.messagePack,
    MIME_TYPES.bson,
    MIME_TYPES.cbor,
  ] as const,
} as const;

/**
 * Utility functions for MIME type operations.
 */
export const MimeTypeUtils = {
  /**
   * Check if a MIME type is a text type.
   */
  isText: (mimeType: string): mimeType is TextMimeType =>
    mimeType.startsWith("text/") ||
    mimeType === MIME_TYPES.json ||
    mimeType === MIME_TYPES.xml ||
    mimeType === MIME_TYPES.graphql ||
    mimeType === MIME_TYPES.graphqlJson ||
    mimeType === MIME_TYPES.ldJson ||
    mimeType === MIME_TYPES.manifestJson ||
    mimeType === MIME_TYPES.geoJson ||
    mimeType === MIME_TYPES.topoJson,

  /**
   * Check if a MIME type is an image type.
   */
  isImage: (mimeType: string): mimeType is ImageMimeType =>
    mimeType.startsWith("image/"),

  /**
   * Check if a MIME type is an audio type.
   */
  isAudio: (mimeType: string): mimeType is AudioMimeType =>
    mimeType.startsWith("audio/"),

  /**
   * Check if a MIME type is a video type.
   */
  isVideo: (mimeType: string): mimeType is VideoMimeType =>
    mimeType.startsWith("video/"),

  /**
   * Check if a MIME type is a font type.
   */
  isFont: (mimeType: string): mimeType is FontMimeType =>
    mimeType.startsWith("font/") || mimeType === MIME_TYPES.eot,

  /**
   * Check if a MIME type is a model type.
   */
  isModel: (mimeType: string): mimeType is ModelMimeType =>
    mimeType.startsWith("model/") ||
    mimeType === MIME_TYPES.obj ||
    mimeType === MIME_TYPES.threeDs ||
    mimeType === MIME_TYPES.fbx,

  /**
   * Check if a MIME type is a multipart type.
   */
  isMultipart: (mimeType: string): mimeType is MultipartMimeType =>
    mimeType.startsWith("multipart/"),

  /**
   * Check if a MIME type is a message type.
   */
  isMessage: (mimeType: string): mimeType is MessageMimeType =>
    mimeType.startsWith("message/"),

  /**
   * Get the file extension for a MIME type.
   */
  getExtension: (mimeType: string): string | undefined => {
    const extensionMap: Record<string, string> = {
      [MIME_TYPES.plain]: "txt",
      [MIME_TYPES.html]: "html",
      [MIME_TYPES.css]: "css",
      [MIME_TYPES.javascript]: "js",
      [MIME_TYPES.typescript]: "ts",
      [MIME_TYPES.json]: "json",
      [MIME_TYPES.xml]: "xml",
      [MIME_TYPES.csv]: "csv",
      [MIME_TYPES.markdown]: "md",
      [MIME_TYPES.yaml]: "yml",
      [MIME_TYPES.toml]: "toml",
      [MIME_TYPES.pdf]: "pdf",
      [MIME_TYPES.zip]: "zip",
      [MIME_TYPES.gzip]: "gz",
      [MIME_TYPES.tar]: "tar",
      [MIME_TYPES.sevenZip]: "7z",
      [MIME_TYPES.rar]: "rar",
      [MIME_TYPES.word]: "docx",
      [MIME_TYPES.excel]: "xlsx",
      [MIME_TYPES.powerpoint]: "pptx",
      [MIME_TYPES.openDocumentText]: "odt",
      [MIME_TYPES.openDocumentSpreadsheet]: "ods",
      [MIME_TYPES.openDocumentPresentation]: "odp",
      [MIME_TYPES.jpeg]: "jpg",
      [MIME_TYPES.png]: "png",
      [MIME_TYPES.gif]: "gif",
      [MIME_TYPES.webp]: "webp",
      [MIME_TYPES.svg]: "svg",
      [MIME_TYPES.ico]: "ico",
      [MIME_TYPES.bmp]: "bmp",
      [MIME_TYPES.tiff]: "tiff",
      [MIME_TYPES.avif]: "avif",
      [MIME_TYPES.mp3]: "mp3",
      [MIME_TYPES.wav]: "wav",
      [MIME_TYPES.ogg]: "ogg",
      [MIME_TYPES.flac]: "flac",
      [MIME_TYPES.aac]: "aac",
      [MIME_TYPES.webm]: "webm",
      [MIME_TYPES.m4a]: "m4a",
      [MIME_TYPES.opus]: "opus",
      [MIME_TYPES.midi]: "midi",
      [MIME_TYPES.aiff]: "aiff",
      [MIME_TYPES.mp4]: "mp4",
      [MIME_TYPES.mov]: "mov",
      [MIME_TYPES.avi]: "avi",
      [MIME_TYPES.wmv]: "wmv",
      [MIME_TYPES.flv]: "flv",
      [MIME_TYPES.threeGp]: "3gp",
      [MIME_TYPES.mkv]: "mkv",
      [MIME_TYPES.m4v]: "m4v",
      [MIME_TYPES.woff]: "woff",
      [MIME_TYPES.woff2]: "woff2",
      [MIME_TYPES.ttf]: "ttf",
      [MIME_TYPES.otf]: "otf",
      [MIME_TYPES.eot]: "eot",
      [MIME_TYPES.gltf]: "gltf",
      [MIME_TYPES.glb]: "glb",
      [MIME_TYPES.stl]: "stl",
      [MIME_TYPES.ply]: "ply",
      [MIME_TYPES.threeDs]: "3ds",
      [MIME_TYPES.fbx]: "fbx",
      [MIME_TYPES.dae]: "dae",
    };

    return extensionMap[mimeType];
  },

  /**
   * Get the MIME type for a file extension.
   */
  fromExtension: (extension: string): MimeType | undefined => {
    const mimeTypeMap: Record<string, MimeType> = {
      txt: MIME_TYPES.plain,
      html: MIME_TYPES.html,
      htm: MIME_TYPES.html,
      css: MIME_TYPES.css,
      js: MIME_TYPES.javascript,
      ts: MIME_TYPES.typescript,
      json: MIME_TYPES.json,
      xml: MIME_TYPES.xml,
      csv: MIME_TYPES.csv,
      md: MIME_TYPES.markdown,
      yml: MIME_TYPES.yaml,
      yaml: MIME_TYPES.yaml,
      toml: MIME_TYPES.toml,
      pdf: MIME_TYPES.pdf,
      zip: MIME_TYPES.zip,
      gz: MIME_TYPES.gzip,
      tar: MIME_TYPES.tar,
      "7z": MIME_TYPES.sevenZip,
      rar: MIME_TYPES.rar,
      docx: MIME_TYPES.word,
      xlsx: MIME_TYPES.excel,
      pptx: MIME_TYPES.powerpoint,
      odt: MIME_TYPES.openDocumentText,
      ods: MIME_TYPES.openDocumentSpreadsheet,
      odp: MIME_TYPES.openDocumentPresentation,
      jpg: MIME_TYPES.jpeg,
      jpeg: MIME_TYPES.jpeg,
      png: MIME_TYPES.png,
      gif: MIME_TYPES.gif,
      webp: MIME_TYPES.webp,
      svg: MIME_TYPES.svg,
      ico: MIME_TYPES.ico,
      bmp: MIME_TYPES.bmp,
      tiff: MIME_TYPES.tiff,
      tif: MIME_TYPES.tiff,
      avif: MIME_TYPES.avif,
      mp3: MIME_TYPES.mp3,
      wav: MIME_TYPES.wav,
      ogg: MIME_TYPES.ogg,
      flac: MIME_TYPES.flac,
      aac: MIME_TYPES.aac,
      m4a: MIME_TYPES.m4a,
      opus: MIME_TYPES.opus,
      midi: MIME_TYPES.midi,
      aiff: MIME_TYPES.aiff,
      mp4: MIME_TYPES.mp4,
      mov: MIME_TYPES.mov,
      avi: MIME_TYPES.avi,
      wmv: MIME_TYPES.wmv,
      flv: MIME_TYPES.flv,
      "3gp": MIME_TYPES.threeGp,
      mkv: MIME_TYPES.mkv,
      m4v: MIME_TYPES.m4v,
      woff: MIME_TYPES.woff,
      woff2: MIME_TYPES.woff2,
      ttf: MIME_TYPES.ttf,
      otf: MIME_TYPES.otf,
      eot: MIME_TYPES.eot,
      gltf: MIME_TYPES.gltf,
      glb: MIME_TYPES.glb,
      obj: MIME_TYPES.obj,
      stl: MIME_TYPES.stl,
      ply: MIME_TYPES.ply,
      "3ds": MIME_TYPES.threeDs,
      fbx: MIME_TYPES.fbx,
      dae: MIME_TYPES.dae,
    };

    return mimeTypeMap[extension.toLowerCase()];
  },
} as const;
