export function resolveCircleLoginRedirectUri(configuredRedirectUri: string | null | undefined) {
  const redirectUri = configuredRedirectUri?.trim();

  if (redirectUri) {
    return redirectUri;
  }

  return `${window.location.origin}/login`;
}
