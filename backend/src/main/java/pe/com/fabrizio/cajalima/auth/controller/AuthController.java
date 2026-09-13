package pe.com.fabrizio.cajalima.auth.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import pe.com.fabrizio.cajalima.auth.dto.*;
import pe.com.fabrizio.cajalima.auth.service.AuthService;
import pe.com.fabrizio.cajalima.user.dto.UserResponse;
import pe.com.fabrizio.cajalima.user.dto.CreateUserRequest;
import pe.com.fabrizio.cajalima.user.service.UserService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;
    private final UserService users;

    public AuthController(AuthService auth, UserService users) {
        this.auth = auth;
        this.users = users;
    }

    public record SetupStatus(boolean available) { }

    @GetMapping("/setup")
    public SetupStatus setup() { return new SetupStatus(users.setupAvailable()); }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse register(@Valid @RequestBody CreateUserRequest request) {
        return users.registerOwner(request);
    }

    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @GetMapping("/me")
    public UserResponse me(@AuthenticationPrincipal UserResponse user) { return user; }
}
