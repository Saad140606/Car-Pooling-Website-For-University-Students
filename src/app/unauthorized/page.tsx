export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold mb-4">Unauthorized</h1>
        <p className="text-muted-foreground mb-6">You do not have permission to access this page.</p>
      </div>
    </div>
  );
}
