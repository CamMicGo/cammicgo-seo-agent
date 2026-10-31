/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lint runs separately (npm run lint): older pages still have warnings that must not block deployments.
  eslint: {ignoreDuringBuilds: true},
  // PDF text extraction (drive_read_file) is loaded from node_modules at runtime.
  serverExternalPackages: ['unpdf'],
};
export default nextConfig;
