import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ApplicantProvider } from "@/store/ApplicantContext";
import { AuthProvider } from "@/store/AuthContext";
import { RequireAuth } from "@/components/RequireAuth";
import Home from "./pages/Home";
import Auth from "./pages/Auth";
import AppLayout from "./components/AppLayout";
import Dashboard from "./pages/Dashboard";
import MyProfile from "./pages/MyProfile";
import Documents from "./pages/Documents";
import Qualification from "./pages/Qualification";
import NextSteps from "./pages/NextSteps";
import Chat from "./pages/Chat";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
          <ApplicantProvider>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/profile" element={<MyProfile />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/qualification" element={<Qualification />} />
                <Route path="/next-steps" element={<NextSteps />} />
                <Route path="/chat" element={<Chat />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ApplicantProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
