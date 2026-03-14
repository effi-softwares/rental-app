import type { NextConfig } from "next"

const publicBlobHostname = process.env.NEXT_PUBLIC_BLOB_HOSTNAME

const nextConfig: NextConfig = {
	images: {
		remotePatterns: [
			publicBlobHostname
				? {
						protocol: "https",
						hostname: publicBlobHostname,
						pathname: "/**",
					}
				: {
						protocol: "https",
						hostname: "**.public.blob.vercel-storage.com",
						pathname: "/**",
					},
		],
	},
}

export default nextConfig
