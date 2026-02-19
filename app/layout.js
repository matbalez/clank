export const metadata = {
  title: "AMA Service",
  description: "Agent Money Address registration API"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
