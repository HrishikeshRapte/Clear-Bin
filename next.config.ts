// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;

// import { Web3Auth } from "@web3auth/modal";
import { Database } from "lucide-react";
import type { NextConfig } from "next";


const nextConfig: NextConfig = {
  env: {
    DATABASE_URL: process.env.DATABASE_URL,
    Web3_Auth_CLIENT_ID: process.env.WEB3_AUTH_CLIENT_ID,
    NEXT_PUBLIC_GEMINI_API_KEY: process.env.NEXT_PUBLIC_GEMINI_API_KEY,
    NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  },


  webpack: (config, { isServer }) => {
  if (isServer) {
    config.externals.push('@react-native-async-storage/async-storage');
  }
  return config;
}


};
export default nextConfig;